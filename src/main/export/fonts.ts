/** Resolves the real font name, size and weight for a text role (slides use the profile only). */
import type { ColorValue } from '@shared/deck/types'
import type { FontSpec, StyleProfile } from '@shared/style/types'

/** A fully resolved text look, ready for PptxGenJS. */
export interface ResolvedFont {
  family: string
  sizePt: number
  bold: boolean
  color: ColorValue
  uppercase: boolean
  /** Extra letter spacing in points (0 = none). */
  letterSpacingPt: number
  /** The profile says this family can be rendered offline; `false` triggers an export warning. */
  available: boolean
}

interface RoleDefault {
  font: 'title' | 'body'
  sizePt?: number
  scale?: number
  bold?: boolean
  color: ColorValue
  uppercase?: boolean
  letterSpacingEm?: number
}

const ROLE_DEFAULTS: Record<string, RoleDefault> = {
  title: { font: 'title', color: 'token:text' },
  kicker: {
    font: 'body',
    sizePt: 13,
    bold: true,
    color: 'token:accent',
    uppercase: true,
    letterSpacingEm: 0.12
  },
  subtitle: { font: 'body', scale: 1.2, color: 'token:muted' },
  heading: { font: 'body', sizePt: 24, bold: true, color: 'token:text' },
  body: { font: 'body', color: 'token:text' },
  caption: { font: 'body', sizePt: 14, color: 'token:muted' },
  label: { font: 'body', sizePt: 14, bold: true, color: 'token:text' },
  chip: { font: 'body', sizePt: 15, bold: true, color: 'token:chipText' },
  callout: { font: 'body', sizePt: 18, color: 'token:text' },
  table: { font: 'body', sizePt: 16, color: 'token:text' }
}

/** Fonts used when the deck has no StyleProfile. */
const PLAIN: Record<'title' | 'body', FontSpec> = {
  title: {
    family: 'Calibri',
    weight: 700,
    sizePt: 40,
    fallbackStack: 'Calibri, sans-serif',
    available: true
  },
  body: {
    family: 'Calibri',
    weight: 400,
    sizePt: 20,
    fallbackStack: 'Calibri, sans-serif',
    available: true
  }
}

/**
 * Resolves a text look. Precedence: the component named by `styleRef` (e.g. `kicker`), then the
 * defaults for `role` (e.g. `title`, `chip`), then the profile's title/body font.
 */
export function resolveFont(
  role: string,
  style: StyleProfile | null,
  styleRef?: string
): ResolvedFont {
  const fallback = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.body
  const component = styleRef ? style?.components[styleRef] : undefined
  // The case flags follow the on-screen renderer (`findComponent`): the styleRef, then the component named like the role.
  const caseComponent = component ?? style?.components[role]
  const slot = component?.font ?? fallback.font
  const fonts = style?.tokens.fonts
  const spec =
    (slot === 'accent' ? fonts?.accent : fonts?.[slot]) ??
    fonts?.body ??
    PLAIN[slot === 'title' ? 'title' : 'body']
  const sizePt =
    component?.sizePt ?? fallback.sizePt ?? Math.round(spec.sizePt * (fallback.scale ?? 1))
  // With a profile component a missing flag means "keep her case" (§5.7 defect 5); role defaults apply only without one.
  const em = caseComponent ? (caseComponent.letterSpacingEm ?? 0) : (fallback.letterSpacingEm ?? 0)
  return {
    family: spec.family,
    sizePt,
    bold: component?.bold ?? fallback.bold ?? spec.weight >= 600,
    color: (component?.color as ColorValue | undefined) ?? fallback.color,
    uppercase: caseComponent ? (caseComponent.uppercase ?? false) : (fallback.uppercase ?? false),
    letterSpacingPt: Math.round(em * sizePt * 100) / 100,
    available: spec.available
  }
}
