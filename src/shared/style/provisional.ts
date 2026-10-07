/**
 * Builds a provisional profile from the local vote (no AI) so the Create a style screen can draw its
 * preview slide with her real colours and fonts before Claude's synthesis has run.
 */
import type { LearnedSoFar } from './votes'
import type { FontSpec, StyleProfile } from './types'

const ROLE_TOKEN = {
  background: 'background',
  text: 'text',
  accent: 'accent',
  highlight: 'highlight',
  chip: 'chipBg'
} as const

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const luma = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return luma > 150 ? '#1F2937' : '#FFFFFF'
}

function withFont(base: FontSpec, vote: LearnedSoFar['fonts'][number] | undefined): FontSpec {
  if (!vote) return base
  const weight = ([400, 500, 600, 700, 800] as const).find((w) => w === vote.weight) ?? base.weight
  return {
    ...base,
    family: vote.family,
    weight,
    sizePt: vote.sizeRangePt
      ? Math.round((vote.sizeRangePt[0] + vote.sizeRangePt[1]) / 2)
      : base.sizePt,
    sizeRangePt: vote.sizeRangePt ?? undefined,
    fallbackStack: `'${vote.family}', ${base.fallbackStack}`,
    available: false // unknown until the font check runs
  }
}

/** Overlays what has been learned on `base`; never changes identity, status, sources or corrections. */
export function provisionalProfile(base: StyleProfile, learned: LearnedSoFar): StyleProfile {
  const colors = { ...base.tokens.colors }
  for (const [role, token] of Object.entries(ROLE_TOKEN)) {
    const hex = learned.palette[role as keyof typeof ROLE_TOKEN]
    if (hex) colors[token] = { ...(colors[token] ?? { label: token, usage: '' }), hex }
  }
  const chipBg = learned.palette.chip
  if (chipBg) colors.chipText = { ...colors.chipText, hex: readableOn(chipBg) }

  const titleFont = learned.fonts.find((f) => f.use === 'title')
  const bodyFont =
    learned.fonts.find((f) => f.use === 'body') ?? learned.fonts.find((f) => f.use === 'other')
  return {
    ...base,
    tokens: {
      colors,
      fonts: {
        title: withFont(base.tokens.fonts.title, titleFont),
        body: withFont(base.tokens.fonts.body, bodyFont)
      }
    },
    slideTypes: learned.slideKinds.map((vote) => ({
      kind: vote.kind,
      name: vote.kind,
      frequency: vote.frequency,
      description: `${vote.slides} slides across ${vote.files} files`
    })),
    lessonFlow: learned.lessonFlow,
    habits: learned.habits.map((h) => h.text),
    voice: {
      ...base.voice,
      spelling: learned.spelling ?? base.voice.spelling,
      rules: learned.voiceRules.map((r) => r.text),
      phrases: learned.phrases.map((p) => p.text)
    }
  }
}
