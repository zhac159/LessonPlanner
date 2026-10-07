/**
 * Picture habits from facts: where her pictures sit, which kinds she uses, which slide types never have any, and
 * which asset goes with which slide type. Deterministic and local: the extraction service
 * (src/main/import/assets) reports every picture with its slide and box, the style's per-file analysis says what
 * kind each slide is, and this file turns that into `PictureHabits` (agents/ASSETS.md §5.3). No Claude call is
 * needed, so it is cheap, repeatable and unit-tested. Pure.
 */
import type { Box } from '../deck/layout'
import type { SlideKind } from '../deck/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../deck/types'
import type { Anchor, AssetKind, PictureHabits, PicturePlacementRule, PictureUse } from './types'

/** One picture seen on one slide of one source file. */
export interface PictureFact {
  sourceId: string
  slideNumber: number
  slideKind: SlideKind | null
  /** Groups sightings of the same picture across files (the perceptual hash cluster id). */
  assetKey: string
  box: Box
  kind: AssetKind
}

/** Every slide of every source, with or without pictures: the denominator of every ratio. */
export interface SlideFact {
  sourceId: string
  slideNumber: number
  slideKind: SlideKind | null
}

export interface KeptAsset {
  assetKey: string
  assetId: string
}

export interface HabitsInput {
  slides: readonly SlideFact[]
  pictures: readonly PictureFact[]
  /** The pictures she keeps (a rule is only written for these). */
  assets: readonly KeptAsset[]
  /** A picture is "reused" when it shows up in at least this many files. */
  minDecks?: number
}

/** A rule needs the picture on at least this share of that slide type's slides. */
export const RULE_COVERAGE = 0.6
/** A slide type needs at least this many slides before a habit is claimed about it. */
export const MIN_SLIDES_FOR_HABIT = 3

const key = (sourceId: string, slideNumber: number): string => `${sourceId}#${slideNumber}`

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function medianBox(boxes: readonly Box[]): Box {
  return {
    x: Math.round(median(boxes.map((b) => b.x))),
    y: Math.round(median(boxes.map((b) => b.y))),
    w: Math.round(median(boxes.map((b) => b.w))),
    h: Math.round(median(boxes.map((b) => b.h)))
  }
}

/** The nine-cell anchor (thirds of the slide) a box's centre falls in. */
export function anchorOf(box: Box): Anchor {
  const cx = (box.x + box.w / 2) / SLIDE_WIDTH
  const cy = (box.y + box.h / 2) / SLIDE_HEIGHT
  const col = cx < 1 / 3 ? 'left' : cx > 2 / 3 ? 'right' : 'center'
  const row = cy < 1 / 3 ? 'top' : cy > 2 / 3 ? 'bottom' : 'center'
  if (row === 'center') return col === 'center' ? 'center' : col
  return col === 'center' ? row : (`${row}-${col}` as Anchor)
}

/** Distance from the slide's nearest edges, rounded to 8 and kept between 16 and 120 units. */
function marginOf(box: Box): number {
  const edges = [box.x, box.y, SLIDE_WIDTH - (box.x + box.w), SLIDE_HEIGHT - (box.y + box.h)]
  const near = edges.filter((edge) => edge < 200).sort((a, b) => a - b)
  const value = near.length ? near.reduce((sum, edge) => sum + edge, 0) / near.length : 48
  return Math.min(120, Math.max(16, Math.round(value / 8) * 8))
}

const KIND_WORDS: Readonly<Record<SlideKind, string>> = {
  title: 'title',
  'do-now': 'Do Now',
  objectives: 'objectives',
  'key-words': 'key words',
  content: 'content',
  question: 'question',
  activity: 'activity',
  practical: 'practical',
  check: 'check',
  plenary: 'plenary',
  'exit-ticket': 'exit-ticket',
  quiz: 'quiz',
  answers: 'answers',
  section: 'section',
  custom: 'custom'
}

const ASSET_KIND_PLURALS: Readonly<Record<AssetKind, string>> = {
  logo: 'logos',
  icon: 'icons',
  picture: 'illustrations',
  photo: 'photos',
  diagram: 'diagrams',
  banner: 'banners',
  character: 'characters',
  'symbol-card': 'symbol cards'
}

const ANCHOR_WORDS: Readonly<Record<Anchor, string>> = {
  'top-left': 'in the top-left corner',
  top: 'at the top',
  'top-right': 'in the top-right corner',
  left: 'on the left',
  center: 'in the middle',
  right: 'on the right',
  'bottom-left': 'in the bottom-left corner',
  bottom: 'at the bottom',
  'bottom-right': 'in the bottom-right corner'
}

const list = (words: string[]): string =>
  words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`

const usageOf = (ratio: number): PictureUse =>
  ratio >= 0.9
    ? 'always'
    : ratio >= RULE_COVERAGE
      ? 'usually'
      : ratio >= 0.2
        ? 'sometimes'
        : 'never'

/** "about a third of the slide" from the picture's share of the slide's width. */
function shareWords(width: number): string {
  const share = width / SLIDE_WIDTH
  if (share < 0.2) return 'a fifth'
  if (share < 0.28) return 'a quarter'
  if (share < 0.4) return 'a third'
  if (share < 0.55) return 'half'
  return 'most'
}

/** The sentence for a placement rule with the asset's current name as a token: shown in "Picture habits". */
export function placementLine(rule: PicturePlacementRule, name: string): string {
  const scope = rule.slideKind === 'every' ? 'every slide' : `${KIND_WORDS[rule.slideKind]} slides`
  return `{{${name}}} ${ANCHOR_WORDS[rule.anchor]} on ${scope}`
}

/** Builds the habits. Returns empty lists (never throws) when there are no pictures or no slides. */
export function buildPictureHabits(input: HabitsInput): PictureHabits {
  const minDecks = input.minDecks ?? 2
  const slidesOfKind = new Map<SlideKind, Set<string>>()
  const allSlides = new Set<string>()
  for (const slide of input.slides) {
    const id = key(slide.sourceId, slide.slideNumber)
    allSlides.add(id)
    if (slide.slideKind) {
      const set = slidesOfKind.get(slide.slideKind) ?? new Set<string>()
      set.add(id)
      slidesOfKind.set(slide.slideKind, set)
    }
  }

  const sourcesByKey = new Map<string, Set<string>>()
  for (const picture of input.pictures) {
    const set = sourcesByKey.get(picture.assetKey) ?? new Set<string>()
    set.add(picture.sourceId)
    sourcesByKey.set(picture.assetKey, set)
  }
  const reused = (assetKey: string): boolean => (sourcesByKey.get(assetKey)?.size ?? 0) >= minDecks

  // ---- which asset goes with which slide type
  const placements: PicturePlacementRule[] = []
  for (const asset of input.assets) {
    if (!reused(asset.assetKey)) continue
    const facts = input.pictures.filter((p) => p.assetKey === asset.assetKey)
    const decks = sourcesByKey.get(asset.assetKey)?.size ?? 0
    const onSlides = new Set(facts.map((f) => key(f.sourceId, f.slideNumber)))
    const base = (rule: Pick<PicturePlacementRule, 'slideKind'>, boxes: Box[]) => {
      const box = medianBox(boxes)
      placements.push({
        assetId: asset.assetId,
        slideKind: rule.slideKind,
        anchor: anchorOf(box),
        widthUnits: Math.max(16, Math.round(box.w / 10) * 10),
        marginUnits: marginOf(box),
        decks
      })
    }
    if (allSlides.size >= MIN_SLIDES_FOR_HABIT && onSlides.size / allSlides.size >= RULE_COVERAGE) {
      base(
        { slideKind: 'every' },
        facts.map((f) => f.box)
      )
      continue
    }
    for (const [kind, slides] of slidesOfKind) {
      if (slides.size < 2) continue
      const here = facts.filter((f) => f.slideKind === kind)
      const covered = new Set(here.map((f) => key(f.sourceId, f.slideNumber)))
      if (covered.size / slides.size >= RULE_COVERAGE)
        base(
          { slideKind: kind },
          here.map((f) => f.box)
        )
    }
  }

  // ---- how she uses pictures per slide type (reused logos and icons are not "content pictures")
  const content = input.pictures.filter((p) => !reused(p.assetKey))
  const slideKinds: PictureHabits['slideKinds'] = []
  for (const [kind, slides] of slidesOfKind) {
    if (slides.size < MIN_SLIDES_FOR_HABIT) continue
    const here = content.filter((p) => p.slideKind === kind)
    const covered = new Set(here.map((p) => key(p.sourceId, p.slideNumber)))
    slideKinds.push({
      kind,
      pictures: usageOf(covered.size / slides.size),
      typicalBox: here.length ? medianBox(here.map((p) => p.box)) : null
    })
  }

  // ---- plain-English lines
  const lines: string[] = []
  const contentUse = slideKinds.find((s) => s.kind === 'content')
  if (contentUse?.typicalBox && contentUse.pictures !== 'never') {
    const anchor = anchorOf(contentUse.typicalBox)
    const side = anchor.includes('left') ? 'left' : anchor.includes('right') ? 'right' : anchor
    const place = side === 'left' || side === 'right' ? `on the ${side}` : ANCHOR_WORDS[anchor]
    const many = contentUse.pictures === 'sometimes' ? 'some' : 'most'
    lines.push(
      `A picture ${place} of ${many} content slides, about ${shareWords(contentUse.typicalBox.w)} of the slide`
    )
  }
  const kindCounts = new Map<AssetKind, number>()
  for (const picture of content)
    kindCounts.set(picture.kind, (kindCounts.get(picture.kind) ?? 0) + 1)
  const ranked = [...kindCounts].sort((a, b) => b[1] - a[1]).slice(0, 2)
  if (ranked.length) {
    const total = content.length
    const words = ranked.map(([kind]) => ASSET_KIND_PLURALS[kind])
    const top = ranked.reduce((sum, [, n]) => sum + n, 0)
    lines.push(`${top / total >= 0.5 ? 'Mostly' : 'A mix of'} ${list(words)}`)
  }
  const never = slideKinds.filter((s) => s.pictures === 'never').map((s) => KIND_WORDS[s.kind])
  if (never.length) lines.push(`No pictures on ${list(never)} slides`)

  return { lines, slideKinds, placements }
}
