/** Colour/font token resolution for slides (slides use the StyleProfile, never app colours). */
import type { FontSpec, StyleProfile } from '../style/types'
import { safePlaceholder } from './colorGuards'
import type { ColorValue, Fill } from './types'

/** Palette used when a deck has no StyleProfile (or the profile lacks a token). */
export const DEFAULT_PALETTE: Readonly<Record<string, string>> = {
  background: '#FFFFFF',
  text: '#1F2933',
  accent: '#2563EB',
  accent2: '#7C3AED',
  highlight: '#FFE36E',
  chipBg: '#E5EDFB',
  chipText: '#1E3A8A',
  placeholder: '#E5E7EB',
  muted: '#52606D'
}

export type FontRole = 'title' | 'body' | 'accent'

const SYSTEM_STACK = "'Segoe UI', Calibri, Arial, sans-serif"

/** Fonts used when a deck has no StyleProfile. Installed on every Windows PC, so `available`. */
export const DEFAULT_FONTS: Readonly<Record<FontRole, FontSpec>> = {
  title: {
    family: 'Segoe UI',
    weight: 700,
    sizePt: 40,
    fallbackStack: SYSTEM_STACK,
    available: true
  },
  body: {
    family: 'Segoe UI',
    weight: 400,
    sizePt: 20,
    fallbackStack: SYSTEM_STACK,
    available: true
  },
  accent: {
    family: 'Segoe UI',
    weight: 600,
    sizePt: 20,
    fallbackStack: SYSTEM_STACK,
    available: true
  }
}

const SHORT_HEX = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i

/**
 * Resolves `token:name` through the profile (then the default palette); `#hex` passes through with
 * `#RGB` expanded to `#RRGGBB`. Unknown tokens fall back to the default text colour, never to nothing.
 */
export function resolveColor(value: ColorValue, style: StyleProfile | null): string {
  if (!value.startsWith('token:')) return value.replace(SHORT_HEX, '#$1$1$2$2$3$3')
  const name = value.slice('token:'.length)
  // `placeholder` is structural: a one-off picture colour in the profile must never reach a slide (§5.7 defect 3).
  if (name === 'placeholder') return safePlaceholder(style?.tokens.colors[name]?.hex)
  return style?.tokens.colors[name]?.hex ?? DEFAULT_PALETTE[name] ?? DEFAULT_PALETTE.text
}

/** Resolves a font role through the profile. A missing `accent` font falls back to `body`. */
export function resolveFont(role: FontRole, style: StyleProfile | null): FontSpec {
  const fonts = style?.tokens.fonts
  if (!fonts) return DEFAULT_FONTS[role]
  return fonts[role] ?? fonts.body
}

/** CSS colour for a Fill: the resolved hex, or `rgba()` when the fill is partly transparent. */
export function resolveFill(fill: Fill, style: StyleProfile | null): string {
  const hex = resolveColor(fill.color, style)
  const opacity = fill.opacity
  if (opacity === undefined || opacity >= 1) return hex
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(opacity, 0)})`
}
