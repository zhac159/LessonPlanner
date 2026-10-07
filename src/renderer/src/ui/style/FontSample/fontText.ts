/** Wording helpers for the Fonts card: weight names, "Titles · 40–44 pt" and the fallback note. */

const WEIGHT_NAMES: Record<number, string> = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black'
}

/** 700 -> "Bold", 400 -> "Regular"; an unusual weight is shown as its number. */
export function fontWeightName(weight: number): string {
  return WEIGHT_NAMES[weight] ?? String(weight)
}

const USE_LABELS = { title: 'Titles', body: 'Body text', accent: 'Accents' } as const

/** "Titles · 40–44 pt", "Body text · 20 pt" or just "Accents" when the size is unknown. */
export function describeFontUse(
  use: keyof typeof USE_LABELS,
  sizeRangePt: readonly [number, number] | null
): string {
  const label = USE_LABELS[use]
  if (!sizeRangePt) return label
  const [low, high] = sizeRangePt
  return `${label} · ${low === high ? low : `${low}–${high}`} pt`
}

const GENERIC_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'cursive',
  'fantasy'
])
const stripQuotes = (name: string) => name.trim().replace(/^['"]|['"]$/g, '')

/**
 * The font that stands in when `family` is not installed: the first named font after it in the CSS
 * stack ("'Lexend', 'Segoe UI', sans-serif" -> "Segoe UI"), else the generic family, else "a standard font".
 */
export function fallbackFontName(family: string, fallbackStack: string): string {
  const names = fallbackStack
    .split(',')
    .map(stripQuotes)
    .filter((name) => name && name.toLowerCase() !== family.toLowerCase())
  const named = names.find((name) => !GENERIC_FAMILIES.has(name.toLowerCase()))
  return named ?? names[0] ?? 'a standard font'
}

/** The CSS `font-family` for the sample: the stack, or just the family when no stack is known. */
export function sampleFontFamily(family: string, fallbackStack: string): string {
  return fallbackStack.trim() || `'${family}', sans-serif`
}
