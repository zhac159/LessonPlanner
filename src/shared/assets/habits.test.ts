import { describe, expect, it } from 'vitest'
import type { SlideKind } from '../deck/types'
import {
  anchorOf,
  buildPictureHabits,
  placementLine,
  type PictureFact,
  type SlideFact
} from './habits'
import { pictureHabitsSchema } from './schema'

const sources = ['a', 'b', 'c']
const kinds: SlideKind[] = ['title', 'do-now', 'content', 'content', 'objectives', 'exit-ticket']

const slides: SlideFact[] = sources.flatMap((sourceId) =>
  kinds.map((slideKind, i) => ({ sourceId, slideNumber: i + 1, slideKind }))
)

const logoBox = { x: 1620, y: 40, w: 240, h: 260 }
const timerBox = { x: 60, y: 50, w: 120, h: 120 }
const photoBox = { x: 1180, y: 250, w: 640, h: 480 }

const pictures: PictureFact[] = sources.flatMap((sourceId) => [
  { sourceId, slideNumber: 1, slideKind: 'title', assetKey: 'logo', box: logoBox, kind: 'logo' },
  { sourceId, slideNumber: 2, slideKind: 'do-now', assetKey: 'timer', box: timerBox, kind: 'icon' },
  {
    sourceId,
    slideNumber: 3,
    slideKind: 'content',
    assetKey: `p-${sourceId}-3`,
    box: photoBox,
    kind: 'photo'
  },
  {
    sourceId,
    slideNumber: 4,
    slideKind: 'content',
    assetKey: `p-${sourceId}-4`,
    box: photoBox,
    kind: 'photo'
  }
])

const assets = [
  { assetKey: 'logo', assetId: 'ast_logo' },
  { assetKey: 'timer', assetId: 'ast_timer' }
]

describe('anchorOf', () => {
  it('uses thirds of the slide', () => {
    expect(anchorOf(logoBox)).toBe('top-right')
    expect(anchorOf(timerBox)).toBe('top-left')
    expect(anchorOf({ x: 800, y: 40, w: 300, h: 100 })).toBe('top')
    expect(anchorOf({ x: 800, y: 440, w: 300, h: 200 })).toBe('center')
    expect(anchorOf({ x: 1500, y: 400, w: 300, h: 200 })).toBe('right')
    expect(anchorOf({ x: 100, y: 900, w: 200, h: 100 })).toBe('bottom-left')
  })
})

describe('buildPictureHabits', () => {
  const habits = buildPictureHabits({ slides, pictures, assets })

  it('writes a placement rule for each reused asset and the slide type it goes with', () => {
    expect(habits.placements).toEqual([
      {
        assetId: 'ast_logo',
        slideKind: 'title',
        anchor: 'top-right',
        widthUnits: 240,
        marginUnits: 48,
        decks: 3
      },
      {
        assetId: 'ast_timer',
        slideKind: 'do-now',
        anchor: 'top-left',
        widthUnits: 120,
        marginUnits: 56,
        decks: 3
      }
    ])
  })

  it('uses "every slide" when a picture is on most slides', () => {
    const everywhere: PictureFact[] = slides.map((s) => ({
      ...s,
      assetKey: 'logo',
      box: logoBox,
      kind: 'logo' as const
    }))
    const result = buildPictureHabits({ slides, pictures: everywhere, assets })
    expect(result.placements).toHaveLength(1)
    expect(result.placements[0]?.slideKind).toBe('every')
  })

  it('does not call a picture a habit when it was seen in one file only', () => {
    const once = pictures.filter((p) => p.sourceId === 'a')
    expect(buildPictureHabits({ slides, pictures: once, assets }).placements).toEqual([])
  })

  it('says how pictures are used per slide type, ignoring reused logos and icons', () => {
    const byKind = Object.fromEntries(habits.slideKinds.map((s) => [s.kind, s]))
    expect(byKind.content?.pictures).toBe('always')
    expect(byKind.content?.typicalBox).toEqual(photoBox)
    expect(byKind.title?.pictures).toBe('never')
    expect(byKind.title?.typicalBox).toBeNull()
    expect(byKind.objectives?.pictures).toBe('never')
    expect(byKind['do-now']?.pictures).toBe('never')
  })

  it('writes plain-English lines', () => {
    expect(habits.lines).toEqual([
      'A picture on the right of most content slides, about a third of the slide',
      'Mostly photos',
      'No pictures on title, Do Now, objectives or exit-ticket slides'
    ])
  })

  it('stays valid for the schema and survives empty input', () => {
    expect(pictureHabitsSchema.safeParse(habits).success).toBe(true)
    expect(buildPictureHabits({ slides: [], pictures: [], assets: [] })).toEqual({
      lines: [],
      slideKinds: [],
      placements: []
    })
  })

  it('does not claim a habit for a slide type seen fewer than three times', () => {
    const few = buildPictureHabits({ slides: slides.slice(0, 2), pictures: [], assets: [] })
    expect(few.slideKinds).toEqual([])
  })
})

describe('placementLine', () => {
  it('names the asset as a token so the Picture habits card draws a chip', () => {
    const rule = {
      assetId: 'ast_logo',
      slideKind: 'title' as const,
      anchor: 'top-right' as const,
      widthUnits: 240,
      marginUnits: 48,
      decks: 3
    }
    expect(placementLine(rule, 'school_logo')).toBe(
      '{{school_logo}} in the top-right corner on title slides'
    )
    expect(
      placementLine({ ...rule, slideKind: 'every', anchor: 'bottom-left' }, 'owl_mascot')
    ).toBe('{{owl_mascot}} in the bottom-left corner on every slide')
    expect(placementLine({ ...rule, slideKind: 'do-now', anchor: 'left' }, 'timer_icon')).toBe(
      '{{timer_icon}} on the left on Do Now slides'
    )
  })
})
