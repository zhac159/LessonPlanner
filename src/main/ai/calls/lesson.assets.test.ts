/** writeSlide with the teacher's assets: the prompt, the cache layout and the mapping to library pictures and spots. */
import { describe, expect, it } from 'vitest'
import type { AssetFact, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { ImageElement } from '@shared/deck/types'
import { fixtureProfile } from '../fake/fixtures'
import { buildAssetCatalogue } from '../prompts/assets'
import { sampleSlideWire, wireElement } from '../sampleDrafts'
import { createRig, jsonMessage } from '../testing'
import { fakeAsset } from '../../services/assets/testing'
import { defaultDeps, type CallDeps } from './deps'
import { writeSlide } from './lesson'

const profile = fixtureProfile()
const brief: LessonBrief = { title: 'Photosynthesis', objectives: ['Describe it'] }
const plan: LessonPlan = {
  title: 'Photosynthesis',
  summary: 'A plan.',
  slides: [
    {
      kind: 'title',
      layoutId: 'title-centre',
      purpose: 'Open the lesson',
      keyContent: ['Photosynthesis'],
      objectiveRefs: [0]
    },
    {
      kind: 'content',
      layoutId: 'content-text-left-image-right',
      purpose: 'Where it happens',
      keyContent: ['Leaves'],
      objectiveRefs: [0]
    }
  ]
}

const logo = fakeAsset('school_logo', {
  kind: 'logo',
  title: 'School logo',
  description: 'Navy crest',
  file: { ext: '.png', width: 400, height: 400, bytes: 1, sha256: 'a', phash: null, vector: false }
})

const writerWire = (
  ...extra: Array<Partial<ReturnType<typeof wireElement>> & Record<string, unknown>>
) => {
  const wire = sampleSlideWire()
  const plain = wire.elements.map((e) => ({
    ...e,
    assetName: '',
    spotKind: '',
    spotQuery: '',
    tail: ''
  }))
  const more = extra.map((e) => ({
    ...wireElement({ type: 'image' }),
    assetName: '',
    spotKind: '',
    spotQuery: '',
    tail: '',
    ...e
  }))
  return { ...wire, elements: [...plain, ...more] }
}

const run = async (reply: unknown, input: Record<string, unknown> = {}) => {
  const rig = createRig([jsonMessage(reply)])
  const deps: CallDeps = { ...defaultDeps(rig.runner), newId: (p) => `${p}_new` }
  const result = await writeSlide(deps, { profile, brief, plan, index: 0, ...input })
  return { rig, ...result }
}

describe('writeSlide with her assets', () => {
  it('adds the catalogue as its own cached system part after the profile, so the shared prefix still hits', async () => {
    const catalogue = buildAssetCatalogue([logo])
    const { rig } = await run(writerWire(), { assets: catalogue })
    const system = rig.stub.requests[0].system as Array<{ text: string; cache_control?: unknown }>
    expect(system).toHaveLength(3)
    expect(system[2].text).toBe(catalogue.text)
    expect(system[2].cache_control).toEqual({ type: 'ephemeral' })

    const plain = await run(writerWire())
    expect(plain.rig.stub.requests[0].system).toEqual(system.slice(0, 2))
    // Still at most four cache breakpoints: head, profile, assets, the lesson block.
    const content = rig.stub.requests[0].messages[0].content as Array<{ cache_control?: unknown }>
    expect(system.length + content.filter((b) => b.cache_control).length).toBeLessThanOrEqual(4)
  })

  it('tells the writer to use names, keep to her rules, never invent a name and leave spots (not text)', async () => {
    const { rig } = await run(writerWire())
    const task = (rig.stub.requests[0].messages[0].content as Array<{ text: string }>)[0].text
    expect(task).toContain('assetName')
    expect(task).toContain('every slide')
    expect(task).toContain('Never invent an asset name')
    expect(task).toContain('picture spot')
    expect(task).toContain('spotQuery')
    expect(task).toContain('never write the description as text on the slide')
    expect(task).not.toContain('there is no image search yet')
  })

  it('maps a placed asset to its id and a spot to a placeholder with hints', async () => {
    const catalogue = buildAssetCatalogue([logo])
    const { slide } = await run(
      writerWire(
        { assetName: 'school_logo', x: 1632, y: 48, w: 240, h: 240, locked: true },
        {
          description: 'A leaf in sunlight, close up',
          spotKind: 'photo',
          spotQuery: 'leaf sunlight'
        },
        { assetName: 'owl_mascot' }
      ),
      { assets: catalogue }
    )
    const [, , placed, spot, unknown] = slide.elements as ImageElement[]
    expect(placed).toMatchObject({ assetId: logo.id, name: 'school_logo', fit: 'contain' })
    expect(placed.locked).toBeUndefined()
    expect(spot.placeholder).toEqual({
      description: 'A leaf in sunlight, close up',
      kind: 'photo',
      query: 'leaf sunlight'
    })
    expect(unknown.assetId).toBeUndefined()
    expect(unknown.placeholder?.description).toBe('owl mascot')
  })

  it('knows names the catalogue text cut off', async () => {
    const find = (name: string): AssetFact | undefined =>
      name === 'far_away' ? { ...logoFact(), name: 'far_away', id: 'ast_far' } : undefined
    const { slide } = await run(writerWire({ assetName: 'far_away', w: 200, h: 200 }), {
      assets: { text: 'block', find }
    })
    expect((slide.elements.at(-1) as ImageElement).assetId).toBe('ast_far')
  })
})

function logoFact(): AssetFact {
  return {
    id: logo.id,
    name: logo.name,
    title: logo.title,
    kind: 'logo',
    description: '',
    tags: [],
    width: 400,
    height: 400,
    vector: false
  }
}
