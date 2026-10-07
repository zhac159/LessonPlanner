/**
 * Maps a style draft (styleDraft.ts) to a real `StyleProfile`: rebuilds the maps, snaps font weights, normalises hex
 * colours, preserves everything the AI does not own (id, sources, exemplars, corrections) and finally validates with
 * the shared `styleProfileSchema`. Also extracts the finished sections of a half-streamed draft for live display.
 */
import { z } from 'zod'
import type { Slide } from '@shared/deck/types'
import { parseStyleProfile } from '@shared/style/schema'
import { normaliseHex } from '@shared/style/votes'
import type { ComponentStyle, FontSpec, StyleProfile } from '@shared/style/types'
import { checkedSlide, type SlideWire } from './slide'
import {
  colourDraft,
  componentDraft,
  fontDraft,
  layoutDraft,
  slideTypeDraft,
  voiceDraft,
  type StyleDraft
} from './styleDraft'

/** Fonts the app can draw offline: bundled with the app (@fontsource) or installed with Windows. */
export const AVAILABLE_FONTS: readonly string[] = [
  'Bricolage Grotesque',
  'Figtree',
  'Inter',
  'Lexend',
  'Nunito',
  'Open Sans',
  'Poppins',
  'Segoe UI',
  'Calibri',
  'Arial'
]

const WEIGHTS = [400, 500, 600, 700, 800] as const

export function snapWeight(weight: number): FontSpec['weight'] {
  const target = Number.isFinite(weight) ? weight : 400
  return WEIGHTS.reduce(
    (best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best),
    400
  )
}

function toFont(font: z.infer<typeof fontDraft>): FontSpec {
  const range: [number, number] | undefined =
    font.sizeMinPt > 0 && font.sizeMaxPt >= font.sizeMinPt
      ? [font.sizeMinPt, font.sizeMaxPt]
      : undefined
  return {
    family: font.family,
    weight: snapWeight(font.weight),
    sizePt: font.sizePt > 0 ? font.sizePt : 20,
    ...(range ? { sizeRangePt: range } : {}),
    fallbackStack: font.fallbackStack || `'${font.family}', 'Segoe UI', Arial, sans-serif`,
    available: AVAILABLE_FONTS.includes(font.family)
  }
}

function toComponent(c: z.infer<typeof componentDraft>): ComponentStyle {
  return {
    description: c.description,
    ...(c.font === 'none' ? {} : { font: c.font }),
    ...(c.sizePt > 0 ? { sizePt: c.sizePt } : {}),
    ...(c.bold ? { bold: true } : {}),
    ...(c.color ? { color: c.color } : {}),
    ...(c.fill ? { fill: c.fill } : {}),
    ...(c.radius > 0 ? { radius: c.radius } : {}),
    ...(c.uppercase ? { uppercase: true } : {}),
    ...(c.letterSpacingEm !== 0 ? { letterSpacingEm: c.letterSpacingEm } : {}),
    ...(c.rules.length ? { rules: c.rules } : {})
  }
}

function toColors(colors: StyleDraft['colors']): StyleProfile['tokens']['colors'] {
  const out: StyleProfile['tokens']['colors'] = {}
  for (const { token, hex, label, usage } of colors) {
    const normalised = normaliseHex(hex)
    if (token && normalised) out[token] = { hex: normalised, label, usage }
  }
  return out
}

const toLayout = (l: z.infer<typeof layoutDraft>): StyleProfile['layouts'][number] => ({
  ...l,
  regions: l.regions.map(({ styleRef, optional, ...region }) => ({
    ...region,
    ...(styleRef ? { styleRef } : {}),
    ...(optional ? { optional: true } : {})
  }))
})

const toSlideType = ({
  typicalPosition,
  exampleText,
  ...habit
}: z.infer<typeof slideTypeDraft>): StyleProfile['slideTypes'][number] => ({
  ...habit,
  ...(typicalPosition === 'none' ? {} : { typicalPosition }),
  ...(exampleText ? { exampleText } : {})
})

export interface DraftContext {
  name: string
  /** The profile being updated; its id, sources, exemplars, corrections and dates are kept. */
  existing?: StyleProfile
  /** ISO time for `updatedAt` (and `createdAt` of a new profile). */
  now: string
  /** Makes a fresh profile id. */
  newId: () => string
}

/** Draft -> validated `StyleProfile` (throws a ZodError if the draft cannot make a valid one). */
export function draftToProfile(draft: StyleDraft, ctx: DraftContext): StyleProfile {
  const { existing } = ctx
  const accent = draft.fonts.accent.family ? toFont(draft.fonts.accent) : undefined
  return parseStyleProfile({
    schemaVersion: 1,
    id: existing?.id ?? ctx.newId(),
    name: ctx.name,
    version: (existing?.version ?? 0) + 1,
    isDefault: existing?.isDefault ?? false,
    status: 'ready',
    tokens: {
      colors: toColors(draft.colors),
      fonts: {
        title: toFont(draft.fonts.title),
        body: toFont(draft.fonts.body),
        ...(accent ? { accent } : {})
      }
    },
    components: Object.fromEntries(draft.components.map((c) => [c.key, toComponent(c)])),
    layouts: draft.layouts.map(toLayout),
    slideTypes: draft.slideTypes.map(toSlideType),
    lessonFlow: draft.lessonFlow,
    voice: {
      spelling: draft.voice.spelling,
      ...(draft.voice.readingAge ? { readingAge: draft.voice.readingAge } : {}),
      rules: draft.voice.rules,
      phrases: draft.voice.phrases,
      ...(draft.voice.questionStyle ? { questionStyle: draft.voice.questionStyle } : {})
    },
    habits: draft.habits,
    exemplars: existing?.exemplars ?? [],
    sources: existing?.sources ?? [],
    corrections: existing?.corrections ?? [],
    confidence: draft.confidence,
    createdAt: existing?.createdAt ?? ctx.now,
    updatedAt: ctx.now
  })
}

/** The test slide of a draft as a real `Slide`. */
export const draftTestSlide = (draft: { testSlide: SlideWire }, id: string): Slide =>
  checkedSlide(draft.testSlide, id)

const sectionOf = <S extends z.ZodType>(schema: S, items: unknown): Array<z.infer<S>> =>
  Array.isArray(items)
    ? items.flatMap((item) => {
        const parsed = schema.safeParse(item)
        return parsed.success ? [parsed.data] : []
      })
    : []

/**
 * Sections of a half-streamed draft that are already complete, as a partial profile for the live "learning"
 * panel. Incomplete list items are skipped; sections appear once and then grow.
 */
export function partialProfile(raw: unknown): Partial<StyleProfile> {
  if (!raw || typeof raw !== 'object') return {}
  const draft = raw as Record<string, unknown>
  const out: Partial<StyleProfile> = {}
  const colors = toColors(sectionOf(colourDraft, draft.colors))
  const fonts = z.object({ title: fontDraft, body: fontDraft }).safeParse(draft.fonts)
  if (fonts.success) {
    out.tokens = {
      colors,
      fonts: { title: toFont(fonts.data.title), body: toFont(fonts.data.body) }
    }
  }
  const layouts = sectionOf(layoutDraft, draft.layouts).map(toLayout)
  if (layouts.length) out.layouts = layouts
  const slideTypes = sectionOf(slideTypeDraft, draft.slideTypes).map(toSlideType)
  if (slideTypes.length) out.slideTypes = slideTypes
  if (Array.isArray(draft.habits)) out.habits = draft.habits.filter((h) => typeof h === 'string')
  const voice = voiceDraft.safeParse(draft.voice)
  if (voice.success)
    out.voice = {
      spelling: voice.data.spelling,
      rules: voice.data.rules,
      phrases: voice.data.phrases
    }
  return out
}
