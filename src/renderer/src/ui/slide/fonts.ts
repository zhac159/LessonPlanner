/**
 * Font loading for slides (registry-driven, no DOM or CSS imports so it is unit-testable). The renderer is offline (CSP), so slide fonts are bundled with @fontsource and loaded
 * lazily: only the fonts a StyleProfile names are fetched. Anything else falls back to the profile's
 * `fallbackStack` (design/deck-model.md §4 "Fonts"). Slides never use the app's own fonts by accident.
 */
import type { FontSpec, StyleProfile } from '@shared/style/types'

export interface BundledFont {
  /** CSS family the bundled @fontsource stylesheet registers, e.g. "Lexend Variable". */
  cssFamily: string
  load: () => Promise<unknown>
}

/** Keyed by lower-case family name as it appears in a profile. */
export type FontRegistry = Readonly<Record<string, BundledFont>>

export interface FontLoader {
  /** True when the app ships this family (so it renders on any PC). */
  isBundled(family: string): boolean
  /** CSS `font-family` value: the bundled face first (if any), then the profile's fallback stack. */
  fontFamilyCss(font: FontSpec): string
  /** Loads every bundled font the profile uses. Safe to call repeatedly; each family loads once. */
  load(style: StyleProfile | null): Promise<void>
}

/** Builds a loader over a registry (tests pass a fake registry; the app uses `slideFonts` from ./bundledFonts). */
export function createFontLoader(registry: FontRegistry): FontLoader {
  const loading = new Map<string, Promise<unknown>>()
  const find = (family: string): BundledFont | undefined => registry[family.trim().toLowerCase()]
  return {
    isBundled: (family) => find(family) !== undefined,
    fontFamilyCss(font) {
      const bundled = find(font.family)
      return bundled ? `'${bundled.cssFamily}', ${font.fallbackStack}` : font.fallbackStack
    },
    async load(style) {
      if (!style) return
      const { title, body, accent } = style.tokens.fonts
      const jobs: Promise<unknown>[] = []
      for (const font of [title, body, accent]) {
        if (!font) continue
        const key = font.family.trim().toLowerCase()
        const bundled = registry[key]
        if (!bundled) continue
        if (!loading.has(key)) {
          // A failed load is forgotten so a later call can retry; the fallback stack keeps text readable.
          loading.set(
            key,
            bundled.load().catch(() => loading.delete(key))
          )
        }
        jobs.push(loading.get(key) as Promise<unknown>)
      }
      await Promise.all(jobs)
    }
  }
}
