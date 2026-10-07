import { describe, expect, it } from 'vitest'
import { elementSchema } from '../deck/schema'
import { LICENCES } from './credits'
import {
  assetSchema,
  pictureFactsFileSchema,
  pictureHabitsSchema,
  pictureSpotSchema,
  safeParseAsset,
  safeParseAssetIndex
} from './schema'
import type { Asset, AssetIndex, PictureHabits } from './types'

export const sampleAsset = (over: Partial<Asset> = {}): Asset => ({
  id: 'ast_01J0000000000000',
  name: 'school_logo',
  title: 'School logo',
  kind: 'logo',
  description: 'School crest: navy shield with a gold chevron and star.',
  tags: ['logo', 'title slides'],
  source: {
    kind: 'extracted',
    styleId: 'sty_1',
    fileName: 'Y8 Photosynthesis.pptx',
    page: 1,
    at: '2026-10-07T09:00:00Z'
  },
  licence: LICENCES.unknown,
  credit: null,
  file: {
    ext: '.png',
    width: 512,
    height: 560,
    bytes: 20480,
    sha256: 'a'.repeat(64),
    phash: '00ff00ff00ff00ff',
    vector: false
  },
  foundIn: [{ styleId: 'sty_1', sourceId: 'src_1', fileName: 'Y8 Photosynthesis.pptx', page: 1 }],
  usedIn: [],
  lastUsedAt: null,
  createdAt: '2026-10-07T09:00:00Z',
  updatedAt: '2026-10-07T09:00:00Z',
  ...over
})

describe('asset schema', () => {
  it('accepts a full asset and every source kind', () => {
    expect(assetSchema.safeParse(sampleAsset()).success).toBe(true)
    const sources: Asset['source'][] = [
      { kind: 'uploaded', fileName: 'owl.png', at: 'x' },
      { kind: 'online', provider: 'openverse', at: 'x' },
      {
        kind: 'generated',
        model: 'gemini-3-pro-image-preview',
        prompt: 'p',
        basedOn: ['ast_1'],
        at: 'x'
      }
    ]
    for (const source of sources)
      expect(assetSchema.safeParse(sampleAsset({ source })).success).toBe(true)
  })

  it('rejects a bad hash, an unknown kind and a missing file block with a readable reason', () => {
    const bad = safeParseAsset({ ...sampleAsset(), kind: 'sticker' })
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.error).toContain('kind')
    expect(
      assetSchema.safeParse({ ...sampleAsset(), file: { ...sampleAsset().file, sha256: 'xyz' } })
        .success
    ).toBe(false)
    expect(safeParseAsset({ ...sampleAsset(), file: undefined }).ok).toBe(false)
  })

  it('does not re-validate stored names against today’s naming rules', () => {
    expect(assetSchema.safeParse(sampleAsset({ name: 'Old Name!' })).success).toBe(true)
  })

  it('parses an index and reports a damaged one', () => {
    const index: AssetIndex = {
      schemaVersion: 1,
      assets: [sampleAsset()],
      updatedAt: '2026-10-07T09:00:00Z'
    }
    expect(safeParseAssetIndex(JSON.parse(JSON.stringify(index)))).toMatchObject({ ok: true })
    const damaged = safeParseAssetIndex({ schemaVersion: 1, assets: [{ id: 1 }], updatedAt: 'x' })
    expect(damaged.ok).toBe(false)
    expect(safeParseAssetIndex('nonsense').ok).toBe(false)
  })
})

describe('picture spot schema', () => {
  it('keeps an old description-only placeholder valid and takes the new hints', () => {
    expect(pictureSpotSchema.safeParse({ description: 'A leaf' }).success).toBe(true)
    expect(
      pictureSpotSchema.safeParse({
        description: 'A leaf',
        kind: 'photo',
        query: 'leaf',
        suggestedAssets: ['ast_1']
      }).success
    ).toBe(true)
    expect(pictureSpotSchema.safeParse({ description: 'A leaf', kind: 'sticker' }).success).toBe(
      false
    )
  })

  it('the Deck element schema still parses an image with the old placeholder', () => {
    const parsed = elementSchema.safeParse({
      id: 'el_1',
      type: 'image',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      fit: 'cover',
      alt: 'leaf',
      placeholder: { description: 'A leaf' }
    })
    expect(parsed.success).toBe(true)
  })
})

describe('picture habits schema', () => {
  const habits: PictureHabits = {
    lines: ['A picture on the right of most content slides, about a third of the slide'],
    slideKinds: [
      { kind: 'content', pictures: 'usually', typicalBox: { x: 1100, y: 240, w: 640, h: 480 } },
      { kind: 'exit-ticket', pictures: 'never', typicalBox: null }
    ],
    placements: [
      {
        assetId: 'ast_1',
        slideKind: 'title',
        anchor: 'top-right',
        widthUnits: 220,
        marginUnits: 48,
        decks: 24
      },
      {
        assetId: 'ast_2',
        slideKind: 'every',
        anchor: 'bottom-left',
        widthUnits: 120,
        marginUnits: 32,
        decks: 9
      }
    ]
  }
  it('accepts habits and rejects a bad anchor', () => {
    expect(pictureHabitsSchema.safeParse(habits).success).toBe(true)
    const bad = { ...habits, placements: [{ ...habits.placements[0], anchor: 'middle-ish' }] }
    expect(pictureHabitsSchema.safeParse(bad).success).toBe(false)
  })
})

describe('credit and picture facts', () => {
  it('stores a credit with its ready-made line', () => {
    const credit = {
      text: 'Picture made with Nano Banana Pro (AI-generated).',
      inNotes: true,
      provider: null,
      author: null,
      title: null,
      pageUrl: null,
      licenceUrl: null
    }
    const made = sampleAsset({
      source: { kind: 'generated', model: 'gemini-3-pro-image', prompt: 'p', basedOn: [], at: 'x' },
      licence: LICENCES.generated,
      credit
    })
    expect(assetSchema.safeParse(made).success).toBe(true)
    expect(assetSchema.safeParse({ ...made, credit: { ...credit, inNotes: 'yes' } }).success).toBe(
      false
    )
  })

  it('parses the per-file picture facts', () => {
    const file = {
      schemaVersion: 1,
      slides: [{ sourceId: 'src_1', slideNumber: 1, slideKind: 'title' }],
      pictures: [
        {
          sourceId: 'src_1',
          slideNumber: 1,
          slideKind: null,
          assetKey: '00ff00ff00ff00ff',
          box: { x: 0, y: 0, w: 10, h: 10 },
          kind: 'logo'
        }
      ]
    }
    expect(pictureFactsFileSchema.safeParse(file).success).toBe(true)
    expect(pictureFactsFileSchema.safeParse({ ...file, slides: [{ sourceId: 'x' }] }).success).toBe(
      false
    )
  })
})
