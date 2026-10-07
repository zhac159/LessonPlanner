/**
 * How a text-like element looks, resolved from the StyleProfile (design/deck-model.md §4 "Element mapping").
 * Shared by the on-screen renderer and the .pptx exporter so they cannot drift. Pure.
 */
import type { ComponentStyle, FontSpec, StyleProfile } from '../style/types'
import { resolveColor, resolveFont, type FontRole } from './tokens'
import type { ColorValue, TextRole } from './types'

export interface ResolvedTextStyle {
  font: FontSpec
  fontRole: FontRole
  /** Base size in points, before any shrink-to-fit. */
  sizePt: number
  /** Weight of non-bold runs (a `bold` run uses 700). */
  weight: number
  /** Resolved `#RRGGBB`. */
  color: string
  uppercase: boolean
  letterSpacingEm: number
}

interface RoleDefaults {
  font: FontRole
  sizePt: number
  bold: boolean
  color: ColorValue
  uppercase?: boolean
  letterSpacingEm?: number
}

/** Used when the profile has no component for a role (or there is no profile). */
const ROLE_DEFAULTS: Record<TextRole, RoleDefaults> = {
  title: { font: 'title', sizePt: 40, bold: true, color: 'token:text' },
  kicker: {
    font: 'body',
    sizePt: 13,
    bold: true,
    color: 'token:accent',
    uppercase: true,
    letterSpacingEm: 0.12
  },
  subtitle: { font: 'body', sizePt: 24, bold: false, color: 'token:muted' },
  heading: { font: 'body', sizePt: 16, bold: true, color: 'token:text' },
  body: { font: 'body', sizePt: 18, bold: false, color: 'token:text' },
  caption: { font: 'body', sizePt: 14, bold: false, color: 'token:muted' },
  label: { font: 'body', sizePt: 14, bold: true, color: 'token:text' }
}

/** `style.components[styleRef]` first, then the component named like the role; null when neither exists. */
export function findComponent(
  style: StyleProfile | null,
  styleRef: string | undefined,
  role?: string
): ComponentStyle | null {
  const components = style?.components
  if (!components) return null
  return (
    (styleRef ? components[styleRef] : undefined) ?? (role ? components[role] : undefined) ?? null
  )
}

/**
 * Resolves font, size, weight and colour for a text element. Precedence for size:
 * the element's own `fontSizePt`, then the component, then the font's typical size for titles, then the role default.
 */
export function resolveTextStyle(
  element: { role: TextRole; styleRef?: string; fontSizePt?: number },
  style: StyleProfile | null
): ResolvedTextStyle {
  const defaults = ROLE_DEFAULTS[element.role]
  const component = findComponent(style, element.styleRef, element.role)
  const fontRole = component?.font ?? defaults.font
  const font = resolveFont(fontRole, style)
  const bold = component ? (component.bold ?? false) : defaults.bold
  const base =
    component?.sizePt ?? (style && element.role === 'title' ? font.sizePt : defaults.sizePt)
  return {
    font,
    fontRole,
    sizePt: element.fontSizePt ?? base,
    weight: bold ? Math.max(font.weight, 700) : font.weight,
    color: resolveColor((component?.color ?? defaults.color) as ColorValue, style),
    // With a profile component a missing flag means "keep her case" (§5.7 defect 5); role defaults apply only without one.
    uppercase: component ? (component.uppercase ?? false) : (defaults.uppercase ?? false),
    letterSpacingEm: component ? (component.letterSpacingEm ?? 0) : (defaults.letterSpacingEm ?? 0)
  }
}
