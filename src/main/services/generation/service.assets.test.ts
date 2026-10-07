import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AiService, AssetCatalogue } from '@shared/ai/types'
import type { PictureHabits } from '@shared/assets/types'
import { listPictureSpots } from '@shared/assets/spots'
import type { ImageElement, Slide } from '@shared/deck/types'
import { ok } from '@shared/result'
import { createFakeAiService } from '../../ai/fake'
import { makeLibrary, ONLINE_CREDIT, type Library } from '../chat/assetsTesting'
import { ChatService } from '../chat/service'
import { SPOT_SENTENCE } from './summary'
import { makeGenerationRig, type GenerationRig } from './testing'

const base = createFakeAiService()
const TEXT = 'Photosynthesis\nLO1: Where it happens\nLO2: The word equation'

const picture = (id: string, assetId: string, name: string, alt: string): ImageElement => ({
  id,
  type: 'image',
  x: 700,
  y: 300,
  w: 500,
  h: 400,
  name,
  assetId,
  fit: 'contain',
  alt
})

const spot = (id: string): ImageElement => ({
  id,
  type: 'image',
  x: 1100,
  y: 300,
  w: 700,
  h: 500,
  fit: 'cover',
  alt: 'A leaf in sunlight, close up',
  placeholder: { description: 'A leaf in sunlight, close up', kind: 'photo' }
})

interface Scripted {
  /** What each writeSlide call received. */
  calls: Array<{ index: number; assets?: AssetCatalogue }>
  ai: Partial<AiService>
}

/** A writer that behaves the way the real one is told to: logo on the title slide, a spot, a vanished asset. */
function scriptedWriter(lib: Library, online: { assetId: string }): Scripted {
  const calls: Scripted['calls'] = []
  const ai: Partial<AiService> = {
    writeSlide: async (input, opts) => {
      calls.push({ index: input.index, assets: input.assets })
      const written = await base.writeSlide(input, opts)
      if (!written.ok) return written
      const slide: Slide = { ...written.slide }
      const extra: ImageElement[] = []
      if (input.index === 0)
        extra.push(picture('s0-logo', lib.logo.id, 'school_logo', 'School logo'))
      if (input.index === 3) extra.push(spot('s3-spot'))
      if (input.index === 4)
        extra.push(picture('s4-leaf', online.assetId, 'sunlit_leaf', 'Leaf in sunlight'))
      if (input.index === 5) extra.push(picture('s5-gone', 'ast_gone', 'old_owl', 'An owl'))
      return ok({ slide: { ...slide, elements: [...slide.elements, ...extra] } })
    }
  }
  return { calls, ai }
}

const EVERY_RULE: PictureHabits = {
  lines: ['Pictures sit on the right of content slides.'],
  slideKinds: [{ kind: 'content', pictures: 'usually', typicalBox: null }],
  placements: []
}

async function generate(rig: GenerationRig) {
  const started = await rig.generation.generate({
    lessonId: rig.lessonId,
    text: TEXT,
    documentIds: [],
    meta: {}
  })
  if (!started.ok) throw new Error(started.message)
  await rig.generation.whenDone(started.jobId)
}

async function rigWith(lib: Library, withRule = true) {
  const saved = await lib.port.saveOnline('res_leaf')
  if (!saved.ok) throw new Error(saved.message)
  const script = scriptedWriter(lib, { assetId: saved.asset.id })
  const rig = await makeGenerationRig({ deps: { assets: lib.port }, ai: script.ai })
  if (withRule) {
    ;(rig.style as unknown as { pictures: PictureHabits }).pictures = {
      ...EVERY_RULE,
      placements: [
        {
          assetId: lib.logo.id,
          slideKind: 'every',
          anchor: 'top-right',
          widthUnits: 200,
          marginUnits: 40,
          decks: 6
        }
      ]
    }
  }
  return { rig, script, onlineAsset: saved.asset }
}

const deckOf = async (rig: GenerationRig) => {
  const opened = await rig.service.open(rig.lessonId)
  if (!opened.ok) throw new Error(opened.message)
  return opened
}

describe('generation with her assets', () => {
  it('tells the writer her assets and her placement rules', async () => {
    const lib = await makeLibrary()
    const { rig, script } = await rigWith(lib)
    await generate(rig)
    expect(script.calls).toHaveLength(8)
    const text = script.calls[0].assets?.text ?? ''
    expect(text).toContain('school_logo · logo · School logo')
    expect(text).toContain('school_logo: every slide, top-right, 200 units wide, 40 from the edge')
    expect(text).toContain('Pictures sit on the right of content slides.')
    expect(script.calls[0].assets?.find('SCHOOL_LOGO')).toMatchObject({ id: lib.logo.id })
    expect(script.calls[0].assets?.find('owl')).toBeUndefined()
  })

  it('puts the school logo on EVERY slide when her decks show it that way: unlocked, once, in her corner', async () => {
    const lib = await makeLibrary()
    const { rig } = await rigWith(lib)
    await generate(rig)
    const { deck } = await deckOf(rig)
    expect(deck.slides).toHaveLength(8)
    for (const slide of deck.slides) {
      const logos = slide.elements.filter(
        (e): e is ImageElement => e.type === 'image' && e.assetId === lib.logo.id
      )
      expect(logos, `slide ${slide.id}`).toHaveLength(1)
      expect(logos[0]).toMatchObject({ name: 'school_logo', fit: 'contain', w: 200, y: 40 })
      expect(logos[0].x + logos[0].w).toBeCloseTo(1920 - 40)
      expect(logos[0].locked).toBeUndefined()
    }
    // The title slide's own picture was snapped to the rule, not duplicated.
    expect(deck.slides[0].elements.filter((e) => e.type === 'image')).toHaveLength(1)
  })

  it('copies each picture into the lesson once and marks the asset used', async () => {
    const lib = await makeLibrary()
    const { rig, onlineAsset } = await rigWith(lib)
    await generate(rig)
    const dir = join(rig.dir, 'lessons', rig.lessonId, 'assets')
    const files = (existsSync(dir) ? readdirSync(dir) : [])
      .filter((f) => f !== 'assets.json')
      .sort()
    expect(files).toEqual([`${lib.logo.id}.png`, `${onlineAsset.id}.png`].sort())
    expect(lib.service.getAsset(lib.logo.id)?.lastUsedAt).not.toBeNull()
    expect(
      (await rig.service.files.readAsset(rig.lessonId, lib.logo.id))?.byteLength
    ).toBeGreaterThan(50)
  })

  it('adds the credit line of a licensed picture to the notes of its slide', async () => {
    const lib = await makeLibrary()
    const { rig } = await rigWith(lib)
    await generate(rig)
    const { deck } = await deckOf(rig)
    const line = `Picture credit: ${ONLINE_CREDIT.text}`
    expect(deck.slides[4].notes).toContain(line)
    expect(deck.slides.filter((s) => s.notes?.includes(line))).toHaveLength(1)
  })

  it('turns a picture whose asset has vanished into a spot, and suggests assets for spots', async () => {
    const lib = await makeLibrary()
    const { rig } = await rigWith(lib)
    await generate(rig)
    const { deck } = await deckOf(rig)
    const gone = deck.slides[5].elements.find((e) => e.id === 's5-gone') as ImageElement
    expect(gone.assetId).toBeUndefined()
    expect(gone.placeholder?.description).toBe('An owl')

    const spots = listPictureSpots(deck.slides)
    const mine = spots.filter((s) => ['s3-spot', 's5-gone'].includes(s.elementId))
    expect(mine.map((s) => s.slideNumber)).toEqual([4, 6])
    const leafSpot = mine[0]
    expect(leafSpot.suggestedAssets).toContain(lib.leaf.id)
    expect(leafSpot.kind).toBe('photo')
  })

  it('says which assets it used and points at the picture spots, with the card switched on', async () => {
    const lib = await makeLibrary()
    const { rig, onlineAsset } = await rigWith(lib)
    await generate(rig)
    const history = await new ChatService({
      lessons: rig.service,
      ai: rig.ai,
      store: rig.store,
      emit: rig.emit
    }).history(rig.lessonId)
    const reply = history.at(-1)
    expect(reply?.role).toBe('assistant')
    expect(reply?.text).toContain(
      'I used {{school_logo}} on every slide and {{sunlit_leaf}} on slide 5.'
    )
    expect(reply?.text.endsWith(`\n\n${SPOT_SENTENCE}`)).toBe(true)
    expect(reply?.showSpots).toBe(true)
    expect(reply?.assets).toEqual(
      expect.arrayContaining([
        { assetId: lib.logo.id, name: 'school_logo' },
        { assetId: onlineAsset.id, name: 'sunlit_leaf' }
      ])
    )
    const streamed = (rig.of('chat:delta') as Array<{ text: string }>).map((d) => d.text).join('')
    expect(streamed).toBe(reply?.text)
  })

  it('keeps the whole generation ONE undo step, pictures included', async () => {
    const lib = await makeLibrary()
    const { rig } = await rigWith(lib)
    await generate(rig)
    expect((await deckOf(rig)).history.canUndo).toBe(true)
    const undone = await rig.service.undo(rig.lessonId)
    if (!undone.ok) throw new Error(undone.message)
    expect(undone.deck.slides).toHaveLength(0)
  })

  it('without a rule, only what Claude placed is used; without a library nothing changes', async () => {
    const lib = await makeLibrary()
    const { rig } = await rigWith(lib, false)
    await generate(rig)
    const { deck } = await deckOf(rig)
    expect(
      deck.slides.filter((s) =>
        s.elements.some((e) => e.type === 'image' && e.assetId === lib.logo.id)
      )
    ).toHaveLength(1)
    const calls: unknown[] = []
    const rig2 = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          calls.push(input.assets)
          return base.writeSlide(input, opts)
        }
      }
    })
    await generate(rig2)
    expect(calls.every((c) => c === undefined)).toBe(true)
  })
})
