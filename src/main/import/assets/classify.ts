/**
 * Kind hint, quality flags and the pupil-photo heuristic. Everything here is a best-effort guess made from
 * cheap signals (see analysis.ts); the review screen (A2) is the safety net, nothing is saved without her OK.
 */
import type { Analysis } from './analysis'
import type { Box, ExtractedImage, ImageOrigin, ImageQuality, KindHint } from './types'

export const SLIDE_W = 1920
export const SLIDE_H = 1080
const SLIDE_AREA = SLIDE_W * SLIDE_H

/** Natural or placed size under this many pixels (on the 1920 grid for placed) is a decorative bit. */
export const MIN_SIDE_PX = 48
/** Aspect ratios beyond this are lines/rules, not pictures. */
export const MAX_ASPECT = 12
/** Share of the slide covered by one picture that makes it a page scan or full-page screenshot. */
const FULL_PAGE_SHARE = 0.85
const BLURRY_BELOW = 22

const areaShare = (box: Box): number => (box.w * box.h) / SLIDE_AREA

/** "Appears on many slides": at least 3 slides and half of them (or 2 of up to 4). */
export function repeatsWidely(repeatedOn: number[], units: number): boolean {
  const n = repeatedOn.length
  if (units <= 0 || n < 2) return false
  return n >= units * 0.5 && (n >= 3 || units <= 4)
}

/** Covers the page, or spans its whole width over half its height (a screenshot of a plan or a scanned sheet). */
export const isPageLike = (box: Box): boolean =>
  areaShare(box) >= FULL_PAGE_SHARE || (box.w >= SLIDE_W * 0.98 && areaShare(box) >= 0.5)

export interface QualityInput {
  width: number
  height: number
  box: Box
  analysis: Analysis | null
  origin: ImageOrigin
}

export function qualityOf({ width, height, box, analysis, origin }: QualityInput): ImageQuality {
  const unreadable = analysis === null
  const natural = width > 0 ? Math.min(width, height) : MIN_SIDE_PX
  const placedMax = Math.max(box.w, box.h)
  const placedMin = Math.min(box.w, box.h)
  const aspect = width > 0 && height > 0 ? Math.max(width / height, height / width) : 1
  const placedAspect = placedMin > 0 ? placedMax / placedMin : 1
  const tooSmall =
    (!unreadable && Math.max(width, height) < MIN_SIDE_PX) ||
    (origin !== 'background' && placedMax > 0 && placedMax < MIN_SIDE_PX)
  const thin = aspect > MAX_ASPECT || placedAspect > MAX_ASPECT || (!unreadable && natural <= 4)
  // Shown more than 2.5 times larger than its pixels, or just very few pixels.
  const lowResolution =
    !unreadable &&
    (Math.max(width, height) < 100 ||
      (box.w > 0 &&
        box.w / Math.max(1, width) > 2.5 &&
        box.h / Math.max(1, height) > 2.5 &&
        box.w > 200))
  const blurScore = analysis?.blurScore ?? null
  const fullPage = origin !== 'background' && isPageLike(box)
  return {
    tooSmall,
    thin,
    lowResolution,
    blurry: blurScore !== null && blurScore < BLURRY_BELOW && Math.max(width, height) >= 200,
    blurScore,
    fullPage,
    unreadable
  }
}

export interface KindInput {
  width: number
  height: number
  box: Box
  origin: ImageOrigin
  repeatedOn: number[]
  units: number
  analysis: Analysis | null
  cardCount: number
  singleCard: boolean
  altText?: string
  nearbyText: string
  isJpeg: boolean
}

export function kindOf(input: KindInput): { kind: KindHint; reasons: string[] } {
  const { analysis, box, repeatedOn, units } = input
  const share = areaShare(box)
  const alt = (input.altText ?? '').toLowerCase()
  const aspect = input.width > 0 ? input.width / input.height : box.h > 0 ? box.w / box.h : 1
  const longest = Math.max(input.width, input.height)
  const reasons: string[] = []
  const done = (kind: KindHint, why: string) => ({ kind, reasons: [...reasons, why] })

  if (/\blogo\b|crest|badge|emblem/.test(alt)) return done('logo', 'its name or alt text says logo')
  if (repeatsWidely(repeatedOn, units) && share < 0.15)
    return done('logo', `repeats on ${repeatedOn.length} of ${units} slides, small`)
  if ((input.origin === 'master' || input.origin === 'layout') && share < 0.15)
    return done('logo', 'sits on the slide master or layout')
  if (/\bicon\b|pictogram|symbol/.test(alt)) reasons.push('alt text says icon/symbol')
  if (!analysis) return done('other', 'could not be decoded')

  if (input.cardCount >= 2)
    return done('symbol-card', `${input.cardCount} cards on a plain background`)
  if (input.singleCard && longest <= 700)
    return done('symbol-card', 'one bordered card on a plain background')

  const wide = aspect >= 3 || aspect <= 1 / 3
  if (wide && analysis.colorBins < 60) return done('banner', 'very wide or tall with few colours')

  const flat = analysis.colorBins <= 28
  const cutout = analysis.transparentFraction >= 0.15 || analysis.edgePlainShare >= 0.85
  if (longest <= 640 && (flat || cutout) && !(analysis.colorBins > 120))
    return done('icon', 'small, few colours, plain or transparent background')
  if (analysis.colorBins >= 40 && longest >= 160)
    return done('photo', `${analysis.colorBins} distinct colours, ${longest}px`)
  if (reasons.length > 0 && longest <= 640) return done('icon', 'small and described as an icon')
  return done('other', 'no clear kind')
}

/** Words that suggest the picture is of the class (heuristic input). */
const CLASS_WORDS =
  /\b(pupils?|students?|children|kids|class(?:room|mates)?|our class|year\s?\d{1,2}|assembly|school trip|sports? day|choir|group photo|swimming|reception|nursery)\b/i

export interface PupilGuess {
  maybePupils: boolean
  reasons: string[]
}

/**
 * HEURISTIC, not a detector: a photo might show pupils when at least two of these hold: class-like words near it
 * or in the slide text, a portrait or group-photo shape, a large share of skin tones. Only ever used to leave a
 * picture unticked and ask the teacher; it never decides on its own to keep or drop anything silently.
 */
export function guessPupils(input: {
  kind: KindHint
  width: number
  height: number
  nearbyText: string
  slideText: string
  altText?: string
  skinFraction: number
}): PupilGuess {
  if (input.kind !== 'photo') return { maybePupils: false, reasons: [] }
  const reasons: string[] = []
  const words = `${input.nearbyText} ${input.altText ?? ''}`
  const wordsNear = CLASS_WORDS.test(words)
  const wordsOnSlide = !wordsNear && CLASS_WORDS.test(input.slideText)
  const ratio = input.height / Math.max(1, input.width)
  const portrait = ratio >= 1.15 && ratio <= 2.2
  const skin = input.skinFraction >= 0.35
  if (wordsNear) reasons.push('class words near it')
  if (wordsOnSlide) reasons.push('class words on the slide')
  if (portrait) reasons.push('portrait shape')
  if (skin) reasons.push('many skin tones')
  // Class words right next to a photo are enough; elsewhere on the slide they need one more sign.
  const maybe = wordsNear || (wordsOnSlide && (portrait || skin)) || (portrait && skin)
  return { maybePupils: maybe, reasons: maybe ? reasons : [] }
}

export const isBigEnough = (image: Pick<ExtractedImage, 'quality'>): boolean =>
  !image.quality.tooSmall && !image.quality.thin
