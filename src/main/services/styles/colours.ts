/**
 * The structural colour tokens are neutral (agents/ASSETS.md §5.7, defect 3): `muted` is a grey and `placeholder` a
 * pale tint of the background. A one-off colour the model put there (a green label seen in one deck, the yellow of one
 * set of symbol cards) is kept under a named extra token instead, so it is still on record but never drives a structure.
 */
import type { StyleProfile } from '@shared/style/types'

type Colours = StyleProfile['tokens']['colors']

const MAX_NEUTRAL_SATURATION = 0.15
const PLACEHOLDER_LIGHTNESS: [number, number] = [0.85, 0.97]

type Hsl = { h: number; s: number; l: number }

function toHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number
  ]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s, l }
}

function fromHsl({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return `#${[r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`
}

const clamp = (value: number, [low, high]: [number, number]): number =>
  Math.min(high, Math.max(low, value))

export const isNeutralGrey = (hex: string): boolean => toHsl(hex).s <= MAX_NEUTRAL_SATURATION

export const isNeutralTint = (hex: string): boolean => {
  const { s, l } = toHsl(hex)
  return (
    s <= MAX_NEUTRAL_SATURATION && l >= PLACEHOLDER_LIGHTNESS[0] && l <= PLACEHOLDER_LIGHTNESS[1]
  )
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)

/** A free `extra_<name>` key for a one-off colour. */
function extraKey(colours: Colours, token: string, label: string): string {
  const base = `extra_${slug(label) || slug(token)}`
  let key = base
  for (let n = 2; colours[key]; n++) key = `${base}_${n}`
  return key
}

/** A grey between the text and the background (a caption colour that is readable on both). */
function neutralGrey(colours: Colours): string {
  const text = toHsl(colours.text?.hex ?? '#1F2937').l
  const background = toHsl(colours.background?.hex ?? '#FFFFFF').l
  return fromHsl({ h: 0, s: 0, l: clamp(text + (background - text) * 0.4, [0.2, 0.8]) })
}

/** A pale tint of the background (never its saturation beyond a hint), for the picture-spot and empty-box tint. */
function backgroundTint(colours: Colours): string {
  const { h, s, l } = toHsl(colours.background?.hex ?? '#FFFFFF')
  const darkBackground = l < 0.5
  return fromHsl({
    h,
    s: Math.min(s, 0.1),
    l: darkBackground ? PLACEHOLDER_LIGHTNESS[0] : clamp(l - 0.05, PLACEHOLDER_LIGHTNESS)
  })
}

/**
 * Returns the colours with `muted` and `placeholder` made structural. A colour that was in the wrong place moves to
 * `extra_<label>` (unless the same hex is already a named token, then it is simply dropped).
 */
export function neutraliseColours(input: Colours): Colours {
  const colours: Colours = { ...input }
  const used = (hex: string): boolean => Object.values(colours).some((c) => c.hex === hex)
  const fix = (
    token: 'muted' | 'placeholder',
    ok: (hex: string) => boolean,
    replacement: (c: Colours) => { hex: string; label: string; usage: string }
  ): void => {
    const current = colours[token]
    if (current && ok(current.hex)) return
    delete colours[token]
    if (current && !used(current.hex))
      colours[extraKey(colours, token, current.label)] = {
        ...current,
        usage: `${current.usage} (one-off, not a style colour)`.trim()
      }
    colours[token] = replacement(colours)
  }
  fix('muted', isNeutralGrey, (c) => ({
    hex: neutralGrey(c),
    label: 'Grey',
    usage: 'Captions and secondary text'
  }))
  fix('placeholder', isNeutralTint, (c) => ({
    hex: backgroundTint(c),
    label: 'Pale tint',
    usage: 'Empty boxes and picture-spot tint (a tint of the background)'
  }))
  return colours
}
