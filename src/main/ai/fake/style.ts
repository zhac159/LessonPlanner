/** Fake style learning: FileAnalysis per file name, and the fixture profile as the "synthesised" style. */
import type { FileAnalysis } from '@shared/ai/types'
import type { StyleProfile } from '@shared/style/types'
import { fixtureProfile } from './fixtures'

const hash = (text: string): number =>
  [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)

const ROLE_BY_TOKEN: Record<string, FileAnalysis['colors'][number]['role']> = {
  background: 'background',
  text: 'text',
  accent: 'accent',
  highlight: 'highlight',
  chipBg: 'chip'
}

/** True for file names the fake treats as unreadable (lets tests and demos exercise the failure path). */
export const isBrokenFile = (fileName: string): boolean => /corrupt|broken/i.test(fileName)

/** A plausible analysis of `fileName`, derived from the fixture profile. Same name, same answer. */
export function fakeAnalysis(fileName: string): FileAnalysis {
  const profile = fixtureProfile()
  const pages = 8 + (hash(fileName) % 10)
  const scanned = /scan|worksheet/i.test(fileName)
  return {
    colors: Object.entries(profile.tokens.colors).map(([token, c]) => ({
      hex: c.hex,
      role: ROLE_BY_TOKEN[token] ?? 'other',
      evidence: `${c.usage} (pages 1–${Math.min(pages, 6)})`,
      frequency: token === 'background' || token === 'text' ? 'most' : 'many'
    })),
    fonts: [
      {
        family: profile.tokens.fonts.title.family,
        usedFor: 'title',
        sizePt: profile.tokens.fonts.title.sizePt,
        weight: 700
      },
      {
        family: profile.tokens.fonts.body.family,
        usedFor: 'body',
        sizePt: profile.tokens.fonts.body.sizePt,
        weight: 400
      }
    ],
    layouts: profile.layouts.map((layout, i) => ({
      name: layout.name,
      description: `${layout.name}: ${layout.regions.map((r) => r.name).join(', ')}`,
      regions: layout.regions.map(({ name, elementType, x, y, w, h }) => ({
        name,
        elementType,
        x,
        y,
        w,
        h
      })),
      pages: [i + 1, i + 4].filter((page) => page <= pages)
    })),
    decorations: [
      {
        description: 'Teal band down the left edge of every slide',
        shape: 'rect',
        x: 0,
        y: 0,
        w: 27,
        h: 1080,
        color: '#0E9AA7'
      }
    ],
    slideKinds: profile.lessonFlow.slice(0, pages).map((kind, i) => ({ page: i + 1, kind })),
    voice: {
      rules: profile.voice.rules,
      phrases: profile.voice.phrases,
      spelling: profile.voice.spelling
    },
    habits: profile.habits,
    exemplarCandidates: [
      { page: 2, why: 'A typical Do Now with numbered questions' },
      { page: 3, why: 'Objectives with key words and a mini-whiteboard task' }
    ],
    ...(scanned
      ? { problems: ['Pages 1–3 are scanned images, so their text could not be read.'] }
      : {})
  }
}

/** The fixture profile presented as the synthesised result for `name`, keeping what `existing` already owns. */
export function fakeProfile(
  name: string,
  existing: StyleProfile | undefined,
  now: string,
  newId: () => string
): StyleProfile {
  const profile = fixtureProfile()
  return {
    ...profile,
    id: existing?.id ?? newId(),
    name,
    version: (existing?.version ?? 0) + 1,
    isDefault: existing?.isDefault ?? false,
    status: 'ready',
    exemplars: existing?.exemplars ?? [],
    sources: existing?.sources ?? [],
    corrections: existing?.corrections ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
}

/** Partial profiles streamed to the "learning" panel, one section at a time. */
export function fakePartials(profile: StyleProfile): Array<Partial<StyleProfile>> {
  return [
    { tokens: profile.tokens },
    { layouts: profile.layouts, slideTypes: profile.slideTypes },
    { voice: profile.voice, habits: profile.habits }
  ]
}

/** The correction the fake applies: appends the teacher's words to the habits list and bumps the version. */
export function fakeCorrection(
  profile: StyleProfile,
  correction: string,
  now: string
): { profile: StyleProfile; message: string } {
  const version = profile.version + 1
  return {
    profile: {
      ...profile,
      version,
      updatedAt: now,
      habits: [...profile.habits, correction],
      corrections: [
        ...profile.corrections,
        { text: correction, at: now, appliedInVersion: version }
      ]
    },
    message: 'Done. I’ve added that to your style.'
  }
}
