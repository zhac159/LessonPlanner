/** Theme colours/fonts from `ppt/theme/theme1.xml`: exact values, better than guessing from pictures. */
import { attr, child, dig, parseXml, type XmlNode } from './xml'

export interface Theme {
  colors: Record<string, string>
  fonts: { major: string | null; minor: string | null }
}

const SLOTS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink'
]

/** Slide-level names (clrMap defaults) → theme slot. */
const SCHEME_ALIAS: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' }

export const EMPTY_THEME: Theme = { colors: {}, fonts: { major: null, minor: null } }

const hex = (value: string | undefined): string | null =>
  value && /^[0-9a-f]{6}$/i.test(value) ? `#${value.toUpperCase()}` : null

/** Reads one colour element (`srgbClr`, `sysClr` or `schemeClr`) from a parent such as `solidFill`. */
export function readColor(parent: XmlNode | undefined, theme: Theme): string | null {
  if (!parent) return null
  const srgb = hex(attr(child(parent, 'srgbClr'), 'val'))
  if (srgb) return srgb
  const sys = hex(attr(child(parent, 'sysClr'), 'lastClr'))
  if (sys) return sys
  const scheme = attr(child(parent, 'schemeClr'), 'val')
  if (!scheme) return null
  return theme.colors[SCHEME_ALIAS[scheme] ?? scheme] ?? null
}

/** Never throws: a missing or odd theme yields an empty one. */
export function parseTheme(xml: string | undefined): Theme {
  if (!xml) return EMPTY_THEME
  try {
    const root = dig(parseXml(xml), 'theme', 'themeElements')
    const scheme = child(root, 'clrScheme')
    const colors: Record<string, string> = {}
    for (const slot of SLOTS) {
      const color = readColor(child(scheme, slot), EMPTY_THEME)
      if (color) colors[slot] = color
    }
    const fonts = child(root, 'fontScheme')
    const face = (which: string) => attr(child(child(fonts, which), 'latin'), 'typeface') || null
    return { colors, fonts: { major: face('majorFont'), minor: face('minorFont') } }
  } catch {
    return EMPTY_THEME
  }
}
