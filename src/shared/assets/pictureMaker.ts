/**
 * The optional picture maker (Google "Nano Banana Pro") and the prompt the app composes for it
 * (agents/ASSETS.md §5.6, screens A7, A8). Model ids, prices and the HTTP call live in ONE place in main:
 * src/main/services/imageProviders/nanoBanana.ts (`NANO_BANANA_PRO_MODEL`, `PICTURE_PRICES_USD`,
 * `estimatePictureCost`); nothing about them is repeated here. Pure.
 */
import type { AssetKind } from './types'

/** The only version counts the sheet offers (A8 "Versions 2 | 4"). */
export const MAKE_VERSION_OPTIONS = [2, 4] as const
export type MakeVersions = (typeof MAKE_VERSION_OPTIONS)[number]

/** Model id recorded on assets Claude drew itself as SVG (no picture-maker key). */
export const VECTOR_MODEL = 'claude-svg'

/**
 * Google AI Studio keys: the classic `AIza…` (39 characters) or the newer `AQ.…` format (about 53 characters,
 * created since 2026-05-28). A shape check only, never proof.
 */
export const looksLikeGoogleKey = (key: string): boolean =>
  /^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{16,200})$/.test(key.replace(/\s+/g, ''))

/** Aspect ratio asked of the picture maker per kind (all are in Google's supported list). */
export function aspectRatioFor(kind: AssetKind): '1:1' | '4:3' | '21:9' {
  switch (kind) {
    case 'banner':
      return '21:9'
    case 'diagram':
    case 'picture':
    case 'photo':
      return '4:3'
    default:
      return '1:1'
  }
}

const KIND_PHRASE: Readonly<Record<AssetKind, string>> = {
  logo: 'logo',
  icon: 'simple icon',
  picture: 'illustration',
  photo: 'photograph',
  diagram: 'labelled-style diagram',
  banner: 'banner graphic',
  character: 'character illustration',
  'symbol-card': 'pictogram'
}

export interface MakePromptInput {
  /** What she typed: "A Bunsen burner with a lit flame". */
  request: string
  kind: AssetKind
  /** Claude's description of the look of the assets she picked ("flat vector, 3 px navy outline, teal fills"). */
  styleDescription: string
}

/**
 * The text sent to the picture maker. It states the subject, the look to match, and the rules that keep results
 * usable on a slide: one subject, plain background, no text, no faces.
 */
export function composeMakePrompt({ request, kind, styleDescription }: MakePromptInput): string {
  const subject = request.trim().replace(/[.\s]+$/, '')
  const photo = kind === 'photo'
  return [
    `Create one ${KIND_PHRASE[kind]} for a school lesson slide: ${subject}.`,
    styleDescription.trim() ? `Match this style exactly: ${styleDescription.trim()}` : '',
    [
      'One clear subject, centred, with a generous margin.',
      photo
        ? 'Natural lighting, realistic.'
        : 'Flat, clean shapes; no gradients or shadows unless the style has them.',
      'Plain white background.',
      'No text, letters, numbers or watermark unless the request asks for words.',
      'No real or recognisable people; no faces of children.'
    ].join(' ')
  ]
    .filter(Boolean)
    .join('\n')
}
