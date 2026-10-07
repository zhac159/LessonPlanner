/** When are two picture occurrences "the same picture"? Used by `finalise` (repeats) and `groupFindings` (merging). */
import { colorDistance, hammingHex } from './analysis'
import type { Box } from './types'

export interface LookFacts {
  hash: string
  width: number
  height: number
  perceptualHash: string
  detailHash: string
  colorSignature: string
}

/** Identical bytes, or the same size and a practically identical look (a re-saved copy). */
export function sameBitmap(a: LookFacts, b: LookFacts): boolean {
  if (a.hash === b.hash) return true
  if (!a.perceptualHash || !b.perceptualHash) return false
  return (
    a.width === b.width &&
    a.height === b.height &&
    hammingHex(a.perceptualHash, b.perceptualHash) <= 3 &&
    hammingHex(a.detailHash, b.detailHash) <= 12 &&
    colorDistance(a.colorSignature, b.colorSignature) <= 12
  )
}

/** Share of the slide width within which two boxes count as "the same position". */
const SAME_PLACE = 0.02

export function samePlace(a: Box, b: Box): boolean {
  const tx = 1920 * SAME_PLACE
  const ty = 1080 * SAME_PLACE
  return (
    Math.abs(a.x - b.x) <= tx &&
    Math.abs(a.y - b.y) <= ty &&
    Math.abs(a.w - b.w) <= tx &&
    Math.abs(a.h - b.h) <= ty
  )
}

/**
 * The logo/footer rule: a picture at the same position and size that looks alike (rough hash match, same colours)
 * on other slides is the same repeated element even when each slide stores its own differently encoded copy.
 * Looking alike is required so that a template's photo slot (different photo, same position) is not a logo.
 */
export function samePlaceAndLook(
  a: LookFacts & { box: Box },
  b: LookFacts & { box: Box }
): boolean {
  if (!a.perceptualHash || !b.perceptualHash || !samePlace(a.box, b.box)) return false
  return (
    hammingHex(a.perceptualHash, b.perceptualHash) <= 10 &&
    hammingHex(a.detailHash, b.detailHash) <= 50 &&
    colorDistance(a.colorSignature, b.colorSignature) <= 25
  )
}
