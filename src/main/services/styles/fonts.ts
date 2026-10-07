/**
 * Which fonts can be drawn on THIS PC and which another PC would need (agents/ASSETS.md §5.7, defect "Comic Sans").
 * A font counts as available when the app bundles it (`AVAILABLE_FONTS`) or Windows has it installed
 * (`readInstalledFonts`, the same registry check the export warning uses). Fonts are never bundled for her.
 */
import type { StyleProfile } from '@shared/style/types'
import { AVAILABLE_FONTS } from '../../ai/schemas/style'
import { isFontInstalled } from '../../export/installedFonts'

/** The installed font names (lower case), or undefined when they cannot be read ("unknown"). */
export type InstalledFonts = () => Promise<ReadonlySet<string> | undefined>

const isBundled = (family: string): boolean =>
  AVAILABLE_FONTS.some((name) => name.toLowerCase() === family.trim().toLowerCase())

/**
 * Marks each font `available` (bundled, or installed here) and lists the families that are not bundled in
 * `fontsNeeded`: those must be installed on any other PC that opens the exported deck.
 */
export async function markFonts(
  profile: StyleProfile,
  installed: InstalledFonts
): Promise<StyleProfile> {
  const names = await installed().catch(() => undefined)
  const { fonts } = profile.tokens
  const mark = <T extends (typeof fonts)['title']>(font: T): T => ({
    ...font,
    available: isBundled(font.family) || (names ? isFontInstalled(names, font.family) : false)
  })
  const marked = {
    title: mark(fonts.title),
    body: mark(fonts.body),
    ...(fonts.accent ? { accent: mark(fonts.accent) } : {})
  }
  const needed = [
    ...new Set(
      Object.values(marked)
        .map((font) => font.family)
        .filter((family) => !isBundled(family))
    )
  ]
  const { fontsNeeded: _previous, ...rest } = profile
  return {
    ...rest,
    tokens: { ...profile.tokens, fonts: marked },
    ...(needed.length ? { fontsNeeded: needed } : {})
  }
}
