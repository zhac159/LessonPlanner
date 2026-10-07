import { describe, expect, it } from 'vitest'
import type { AiService, ChatAssets, PlaceToolArgs } from '@shared/ai/types'
import { isPictureSpot } from '@shared/assets/spots'
import type { ChatSendArgs, RegionDraft } from '@shared/contracts/deck-builder-chat'
import type { ImageElement } from '@shared/deck/types'
import { ok } from '@shared/result'
import { sequentialIds } from '../lessons/testing'
import { makeLibrary, type Library } from './assetsTesting'
import { AssetPlacer } from './placer'
import { ChatService } from './service'
import { makeServicesRig, USAGE, type ServicesRig } from './testing'

const place = (over: Partial<PlaceToolArgs> = {}): PlaceToolArgs => ({
  asset: 'school_logo',
  slideId: 's1',
  anchor: 'top-right',
  boxX: 0,
  boxY: 0,
  boxW: 0,
  boxH: 0,
  region: 0,
  spot: '',
  widthUnits: 0,
  fit: 'fit',
  replaceUnder: false,
  ...over
})

interface Seen {
  text: string
  catalogue: string
  assets?: ChatAssets
}

async function setup(
  script: (assets: ChatAssets, ai: Parameters<AiService['chatTurn']>[0]) => Promise<void>
) {
  const lib = await makeLibrary()
  const seen: Seen[] = []
  const rig = await makeServicesRig({
    lessons: { assets: lib.port },
    ai: {
      chatTurn: async (input) => {
        seen.push({
          text: input.text,
          catalogue: input.assets?.catalogue.text ?? '',
          assets: input.assets
        })
        await script(input.assets!, input)
        return ok({ usage: USAGE, apiBlocks: [] })
      }
    }
  })
  const placer = new AssetPlacer({
    lessons: rig.service,
    assets: lib.port,
    store: rig.store,
    ids: sequentialIds()
  })
  const chat = new ChatService({
    lessons: rig.service,
    ai: rig.ai,
    store: rig.store,
    renderer: rig.renderer,
    emit: rig.emit,
    assets: lib.port,
    placer
  })
  return { lib, rig, chat, seen }
}

const sendArgs = (rig: ServicesRig, over: Partial<ChatSendArgs> = {}): ChatSendArgs => ({
  lessonId: rig.lessonId,
  text: 'hello',
  attachmentIds: [],
  regions: [],
  markup: [],
  selectedSlideId: 's1',
  assetRefs: [],
  ...over
})

async function run(chat: ChatService, args: ChatSendArgs) {
  const started = await chat.send(args)
  if (!started.ok) throw new Error(started.message)
  await chat.whenDone(started.jobId)
}

const refOf = (asset: Library['logo'], name = asset.name) => ({ assetId: asset.id, name })

describe('a chat turn with her assets', () => {
  it('offers the catalogue and checks every {{token}} in her message against the library by id', async () => {
    const { lib, rig, chat, seen } = await setup(async () => undefined)
    // She typed {{logo_old}} before the asset was renamed to school_logo.
    await run(
      chat,
      sendArgs(rig, {
        text: 'Put {{logo_old}} in the top right',
        assetRefs: [refOf(lib.logo, 'logo_old')]
      })
    )
    expect(seen[0].text).toBe('Put {{school_logo}} in the top right')
    expect(seen[0].catalogue).toContain('school_logo · logo · School logo')
    expect(seen[0].catalogue).toContain('leaf_photo · photo')

    const items = await chat.history(rig.lessonId)
    expect(items[0]).toMatchObject({
      role: 'user',
      text: 'Put {{school_logo}} in the top right',
      assets: [{ assetId: lib.logo.id, name: 'school_logo' }]
    })
  })

  it('refuses a name that is not in the library and says which, without starting a turn', async () => {
    const { lib, rig, chat, seen } = await setup(async () => undefined)
    expect(await chat.send(sendArgs(rig, { text: 'Use {{ghost}}' }))).toEqual({
      ok: false,
      code: 'invalid-input',
      message: 'No asset called ghost.'
    })
    await lib.service.remove(lib.logo.id)
    expect(
      await chat.send(sendArgs(rig, { text: 'Use {{school_logo}}', assetRefs: [refOf(lib.logo)] }))
    ).toEqual({
      ok: false,
      code: 'not-found',
      message: 'school_logo isn’t in your library any more.'
    })
    expect(seen).toHaveLength(0)
    expect(await rig.store.read(rig.lessonId)).toEqual([])
  })

  it('place_asset is ONE ChangeSet by Claude: announced, journaled, on the message, one undo', async () => {
    const { lib, rig, chat } = await setup(async (assets) => {
      const placed = await assets.place(place())
      expect(placed).toMatchObject({ ok: true, placed: { w: 240 } })
    })
    await run(chat, sendArgs(rig))

    const changes = rig.of('chat:changes') as Array<{ changeSet: { by: string; summary: string } }>
    expect(changes).toHaveLength(1)
    expect(changes[0].changeSet).toMatchObject({
      by: 'ai',
      summary: 'Added school_logo to slide 1'
    })
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    const logo = opened.deck.slides[0].elements.find((e) => e.type === 'image') as ImageElement
    expect(logo).toMatchObject({ assetId: lib.logo.id, name: 'school_logo' })
    expect(opened.history.undoSummary).toBe('Added school_logo to slide 1')

    const items = await chat.history(rig.lessonId)
    expect(items.at(-1)?.result).toMatchObject({ label: 'Slide 1 changed', undone: false })
    await rig.service.undo(rig.lessonId)
    const after = await rig.service.open(rig.lessonId)
    expect(after.ok && after.deck.slides[0].elements.some((e) => e.type === 'image')).toBe(false)
  })

  it('uses her style’s width when Claude gives none, and 240 without a rule', async () => {
    const { lib, rig, chat } = await setup(async (assets) => {
      await assets.place(place({ slideId: 's2', anchor: 'bottom-left' }))
    })
    await run(chat, sendArgs(rig))
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    const logo = opened.deck.slides[1].elements.find((e) => e.type === 'image')
    expect(logo).toMatchObject({ assetId: lib.logo.id, w: 240, x: 48 })
  })

  it('shows only asset names that exist: unknown braces become plain words, in the stream and in history', async () => {
    const { lib, rig } = await setup(async () => undefined)
    // The scripted turn streams a token cut in two plus an invented one.
    const rigAi: Partial<AiService> = {
      chatTurn: async (_input, sink) => {
        sink.delta('I used {{sch')
        sink.delta('ool_logo}} and {{owl_mascot}} on slide 1.')
        return ok({ usage: USAGE, apiBlocks: [] })
      }
    }
    const chat2 = new ChatService({
      lessons: rig.service,
      ai: { ...rig.ai, ...rigAi } as AiService,
      store: rig.store,
      emit: rig.emit,
      assets: lib.port
    })
    await run(chat2, sendArgs(rig))
    const streamed = (rig.of('chat:delta') as Array<{ text: string }>).map((d) => d.text).join('')
    expect(streamed).toBe('I used {{school_logo}} and owl_mascot on slide 1.')
    const reply = (await chat2.history(rig.lessonId)).at(-1)
    expect(reply).toMatchObject({
      text: 'I used {{school_logo}} and owl_mascot on slide 1.',
      assets: [{ assetId: lib.logo.id, name: 'school_logo' }]
    })
  })

  it('answers place_asset problems in words Claude can act on, and changes nothing', async () => {
    const answers: unknown[] = []
    const { rig, chat } = await setup(async (assets) => {
      answers.push(
        await assets.place(place({ asset: 'owl_mascot' })),
        await assets.place(place({ anchor: 'none' })),
        await assets.place(place({ region: 2 })),
        await assets.place(place({ anchor: 'none', spot: 's1-title' })),
        await assets.place(place({ slideId: 'nope' }))
      )
    })
    await run(chat, sendArgs(rig))
    expect(answers).toEqual([
      { ok: false, error: 'No asset called owl_mascot.' },
      {
        ok: false,
        error: 'Say where it goes: an anchor, a box, a region number or a picture spot.'
      },
      { ok: false, error: 'There is no circled region 2 in this message.' },
      { ok: false, error: 'That picture spot is not on this slide any more.' },
      { ok: false, error: 'That slide can’t be found.' }
    ])
    expect(rig.of('chat:changes')).toEqual([])
  })

  it('list_assets searches the library by words and kind', async () => {
    const found: string[][] = []
    const { rig, chat } = await setup(async (assets) => {
      const names = (query: string, kind: string) => assets.list({ query, kind }).map((a) => a.name)
      found.push(names('leaf', 'any'), names('', 'logo'), names('', 'any'), names('zebra', 'any'))
    })
    await run(chat, sendArgs(rig))
    expect(found[0]).toEqual(['leaf_photo'])
    expect(found[1]).toEqual(['school_logo'])
    expect([...found[2]].sort()).toEqual(['happy_card', 'leaf_photo', 'school_logo', 'water_cycle'])
    expect(found[3]).toEqual([])
  })

  it('a circled region becomes the target: fill = its box, replace swaps the picture under it', async () => {
    const photoBox = { x: 1100, y: 300, w: 700, h: 500 }
    const region: RegionDraft = {
      id: 'r1',
      n: 1,
      slideId: 's3',
      path: [
        [1100, 300],
        [1800, 300],
        [1800, 800],
        [1100, 800]
      ],
      bbox: photoBox,
      targetElementIds: ['s3-photo']
    }
    const { lib, rig, chat } = await setup(async (assets) => {
      const result = await assets.place(
        place({
          asset: 'leaf_photo',
          slideId: 's3',
          anchor: 'none',
          region: 1,
          fit: 'fill',
          replaceUnder: true
        })
      )
      expect(result.ok).toBe(true)
    })
    await run(chat, sendArgs(rig, { regions: [region], selectedSlideId: 's3', text: 'swap this' }))
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    const photo = opened.deck.slides[2].elements.find((e) => e.id === 's3-photo') as ImageElement
    expect(photo).toMatchObject({ assetId: lib.leaf.id, fit: 'cover' })
    expect(isPictureSpot(photo)).toBe(false)
  })

  it('shows the picture-spots card under a message that left spots', async () => {
    const { rig, chat } = await setup(async (_assets, input) => {
      await input.applyOps('Left a picture spot', [
        {
          op: 'addElement',
          slideId: 's2',
          element: {
            id: 's2-spot',
            type: 'image',
            x: 900,
            y: 300,
            w: 800,
            h: 500,
            fit: 'cover',
            alt: 'A leaf in sunlight',
            placeholder: { description: 'A leaf in sunlight, close up', kind: 'photo' }
          }
        }
      ])
    })
    await run(chat, sendArgs(rig, { text: 'add a picture to slide 2', selectedSlideId: 's2' }))
    const reply = (await chat.history(rig.lessonId)).at(-1)
    expect(reply).toMatchObject({ role: 'assistant', showSpots: true })
    // A turn that leaves no new spot does not.
    await run(chat, sendArgs(rig, { text: 'thanks' }))
    expect((await chat.history(rig.lessonId)).at(-1)?.showSpots).toBeUndefined()
  })
})

describe('the demo assistant (fake AI) with an asset chip', () => {
  it('places {{school_logo}} in the top right as one undoable change, the A5 exchange', async () => {
    const lib = await makeLibrary()
    const rig = await makeServicesRig({ lessons: { assets: lib.port } })
    const placer = new AssetPlacer({ lessons: rig.service, assets: lib.port, store: rig.store })
    const chat = new ChatService({
      lessons: rig.service,
      ai: rig.ai,
      store: rig.store,
      emit: rig.emit,
      assets: lib.port,
      placer
    })
    await run(
      chat,
      sendArgs(rig, {
        text: 'Put {{school_logo}} in the top right',
        selectedSlideId: 's3',
        assetRefs: [{ assetId: lib.logo.id, name: 'school_logo' }]
      })
    )
    const opened = await rig.service.open(rig.lessonId)
    if (!opened.ok) throw new Error(opened.message)
    const logo = opened.deck.slides[2].elements.find(
      (e): e is ImageElement => e.type === 'image' && e.assetId === lib.logo.id
    )
    expect(logo).toMatchObject({ name: 'school_logo', fit: 'contain', w: 240, y: 48 })
    expect(logo!.x + logo!.w).toBeCloseTo(1920 - 48)

    const items = await chat.history(rig.lessonId)
    expect(items.at(-1)).toMatchObject({
      role: 'assistant',
      text: 'Done! {{school_logo}} is in the top-right corner of slide 3.',
      assets: [{ assetId: lib.logo.id, name: 'school_logo' }],
      result: { label: 'Slide 3 changed', undone: false }
    })
    const undone = await chat.undoChange(rig.lessonId, items.at(-1)!.result!.changeSetId)
    if (!undone.ok) throw new Error(undone.message)
    expect(
      undone.deck.slides[2].elements.some((e) => e.type === 'image' && e.assetId === lib.logo.id)
    ).toBe(false)
  })
})
