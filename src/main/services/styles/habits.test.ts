import { describe, expect, it } from 'vitest'
import type { PictureHabits } from '@shared/assets/types'
import { createDraftProfile } from '@shared/style/draft'
import { emptyMeta } from './metaSchema'
import {
  habitLines,
  keptAssets,
  keptChanged,
  NO_PORTS,
  pictureView,
  storedPictureView
} from './habits'
import { fakePorts } from './picturesTesting'
import type { StyleState } from './types'

const habits: PictureHabits = {
  lines: ['A picture on the right of most content slides, about a third of the slide'],
  slideKinds: [],
  placements: [
    {
      assetId: 'ast_1',
      slideKind: 'title',
      anchor: 'top-right',
      widthUnits: 220,
      marginUnits: 32,
      decks: 3
    },
    {
      assetId: 'ast_gone',
      slideKind: 'do-now',
      anchor: 'left',
      widthUnits: 100,
      marginUnits: 24,
      decks: 2
    }
  ]
}

function state(over: Partial<StyleState['meta']> = {}, pictures?: PictureHabits): StyleState {
  const profile = createDraftProfile('sty_1', 'Science KS3', 'now')
  if (pictures) profile.pictures = pictures
  return { profile, meta: { ...emptyMeta(), ...over }, analyses: new Map() }
}

const meta = () => ({
  batchId: 'rvb_1' as string | null,
  keys: {
    k1: { sha: 'sha1', keep: true },
    k2: { sha: 'sha2', keep: true },
    k3: { sha: 'sha3', keep: false }
  },
  kept: []
})

describe('habitLines', () => {
  it('writes general lines first, then one line per rule with the asset’s CURRENT name, skipping deleted assets', () => {
    const { ports, library } = fakePorts()
    library.saved.set('sha1', { id: 'ast_1', name: 'school_logo' })
    expect(habitLines(habits, ports.assets)).toEqual([
      'A picture on the right of most content slides, about a third of the slide',
      '{{school_logo}} in the top-right corner on title slides'
    ])
    library.saved.set('sha1', { id: 'ast_1', name: 'logo_2' })
    expect(habitLines(habits, ports.assets)[1]).toBe(
      '{{logo_2}} in the top-right corner on title slides'
    )
  })

  it('has no lines for a style without picture habits, and only general lines without a library', () => {
    expect(habitLines(undefined, null)).toEqual([])
    expect(habitLines(habits, null)).toEqual([habits.lines[0]])
  })
})

describe('kept assets', () => {
  it('are the groups whose picture is saved in the library, and a change in what is saved is noticed', () => {
    const { ports, library } = fakePorts()
    const s = state({ pictures: meta() }, habits)
    expect(keptAssets(s.meta.pictures, ports.assets)).toEqual([])
    expect(keptChanged(s, ports)).toBe(false)
    library.saved.set('sha2', { id: 'ast_2', name: 'owl' })
    expect(keptAssets(s.meta.pictures, ports.assets)).toEqual([
      { assetKey: 'k2', assetId: 'ast_2' }
    ])
    expect(keptChanged(s, ports)).toBe(true)
    s.meta.pictures!.kept = ['k2:ast_2']
    expect(keptChanged(s, ports)).toBe(false)
    expect(keptChanged(s, NO_PORTS)).toBe(false)
  })
})

describe('pictureView', () => {
  it('is empty with `found: null` before the pictures were looked at', async () => {
    expect(await pictureView(state(), fakePorts().ports)).toEqual({ lines: [], found: null })
  })

  it('shows the counts, the open batch and the first six picture chips of the batch (suggested first)', async () => {
    const { ports, review } = fakePorts()
    await review_with(ports, review, 8)
    const m = meta()
    const view = await pictureView(state({ pictures: m }), ports)
    expect(view.found).toMatchObject({ found: 3, suggested: 2, saved: 0, batchId: 'rvb_1' })
    expect(view.found?.preview).toHaveLength(6)
    expect(view.found?.preview[0]).toMatchObject({ removed: false })
  })

  it('after she keeps them: "saved" counts, the batch is gone and the tiles are the saved assets', async () => {
    const { ports, library, review } = fakePorts()
    review.open = false
    library.saved.set('sha1', { id: 'ast_1', name: 'school_logo' })
    library.saved.set('sha2', { id: 'ast_2', name: 'owl' })
    const view = await pictureView(state({ pictures: meta() }, habits), ports)
    expect(view.found).toMatchObject({ saved: 2, batchId: null })
    expect(view.found?.preview.map((c) => c.name)).toEqual(['school_logo', 'owl'])
    expect(view.lines).toContain('{{school_logo}} in the top-right corner on title slides')
  })

  it('without ports it still reports what was found, and storedPictureView falls back to it', async () => {
    const s = state({ pictures: meta() }, habits)
    const live = await pictureView(s, NO_PORTS)
    expect(live.found).toMatchObject({ found: 3, saved: 0, batchId: null, preview: [] })
    expect(storedPictureView(s).found).toMatchObject({ found: 3, suggested: 2 })
    expect(storedPictureView(s).lines).toEqual(habits.lines)
    expect(storedPictureView(state()).found).toBeNull()
  })
})

/** Puts `count` candidates in the fake queue's batch. */
async function review_with(
  ports: ReturnType<typeof fakePorts>['ports'],
  _review: unknown,
  count: number
): Promise<void> {
  const candidates = Array.from({ length: count }, (_, i) => ({
    id: `id${i}`,
    suggestedName: `pic_${i}`,
    kind: 'photo' as const,
    keep: i < 7,
    foundIn: []
  }))
  await ports.review!.createReviewBatch({
    source: { kind: 'style', styleId: 'sty_1', styleName: 'Science KS3' },
    candidates: candidates as never
  })
}
