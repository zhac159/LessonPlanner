/**
 * Colour guards for slide rendering and export (agents/ASSETS.md §5.7): a structural token must never be a
 * one-off colour from a picture, and text must stay readable on the fill it sits on. Pure, hex in and out.
 */

const HEX6 = /^#([0-9a-f]{6})$/i
const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i

/** The neutral grey used when the profile's `placeholder` token is not a quiet tint. */
export const NEUTRAL_PLACEHOLDER = '#E5E7EB'

/** The tint band of the structural `placeholder` token (same limits as the style synthesis check). */
const MAX_SATURATION = 0.15
const MIN_LIGHTNESS = 0.85
const MAX_LIGHTNESS = 0.97

/** `[r, g, b]` 0..255 for `#RGB` or `#RRGGBB`; `null` for anything else. */
export function parseHex(value: string): [number, number, number] | null {
  const long = HEX6.exec(value)
  if (long) {
    const n = parseInt(long[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const short = HEX3.exec(value)
  if (short)
    return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16)) as [number, number, number]
  return null
}

/**
 * Saturation (HSV: chroma over the brightest channel, so a pale grey-blue stays near 0 while any real colour
 * is high) and lightness (HSL midpoint), both 0..1.
 */
export function saturationAndLightness(rgb: readonly [number, number, number]): [number, number] {
  const [r, g, b] = rgb.map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return [max === 0 ? 0 : (max - min) / max, (max + min) / 2]
}

/** True for a quiet, light, nearly grey tint: the only kind of colour the `placeholder` token may be. */
export function isNeutralTint(hex: string): boolean {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const [saturation, lightness] = saturationAndLightness(rgb)
  return saturation <= MAX_SATURATION && lightness >= MIN_LIGHTNESS && lightness <= MAX_LIGHTNESS
}

/** The profile's placeholder colour when it is a neutral tint, else the neutral grey (never a one-off colour). */
export const safePlaceholder = (hex: string | undefined): string =>
  hex && isNeutralTint(hex) ? hex : NEUTRAL_PLACEHOLDER

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance; 0 for an unparseable colour. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

/** WCAG contrast ratio, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Large bold header text needs 3:1; use a little more so thin Comic Sans still reads. */
export const MIN_TEXT_CONTRAST = 3.5

/**
 * The first candidate that reads on `background` (contrast of at least `min`); otherwise black or white,
 * whichever reads better. A header can therefore never be text and fill of the same colour.
 */
export function readableOn(
  background: string,
  candidates: readonly string[],
  min = MIN_TEXT_CONTRAST
): string {
  for (const candidate of candidates) {
    if (parseHex(candidate) && contrastRatio(candidate, background) >= min) return candidate
  }
  return contrastRatio('#000000', background) >= contrastRatio('#FFFFFF', background)
    ? '#000000'
    : '#FFFFFF'
}
