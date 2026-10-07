/**
 * What the "What I've learned so far" cards need, derived from the two sources the app has:
 * a StyleProfile (after synthesis) or the local vote count (`aggregateAnalyses`, after each file).
 */
import type { StyleProfileView } from '@shared/contracts/style-library'
import type { SlideKind } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import type { ColourRole, LearnedSoFar } from '@shared/style/votes'

/** One field per card; `null` = nothing learned yet, which the card shows as skeleton rows. */
export interface LearnedPanelData {
  colours: StyleProfileView['colours'] | null
  fonts: StyleProfileView['fonts'] | null
  habits: string[] | null
  slideTypes: string[] | null
  voiceRules: string[] | null
}

/** Every card shows its skeleton. */
export const BUILDING: LearnedPanelData = {
  colours: null,
  fonts: null,
  habits: null,
  slideTypes: null,
  voiceRules: null
}

/** The data of a (partial) profile view, or the skeletons when there is no profile yet. */
export function fromProfileView(view: StyleProfileView | null): LearnedPanelData {
  if (!view) return BUILDING
  return {
    colours: view.colours,
    fonts: view.fonts,
    habits: view.habits,
    slideTypes: view.slideTypes,
    voiceRules: view.voiceRules
  }
}

/** The data of a full StyleProfile (fonts in title, body, accent order). */
export function fromProfile(profile: StyleProfile): LearnedPanelData {
  const { fonts } = profile.tokens
  return {
    colours: Object.entries(profile.tokens.colors).map(([token, colour]) => ({ token, ...colour })),
    fonts: (['title', 'body', 'accent'] as const).flatMap((use) => {
      const font = fonts[use]
      return font
        ? [
            {
              use,
              family: font.family,
              weight: font.weight,
              sizeRangePt: font.sizeRangePt ?? null,
              available: font.available,
              fallbackStack: font.fallbackStack
            }
          ]
        : []
    }),
    habits: profile.habits,
    slideTypes: profile.slideTypes.map((type) => type.name),
    voiceRules: profile.voice.rules
  }
}

const ROLE_LABEL: Record<ColourRole, { label: string; usage: string }> = {
  background: { label: 'Background', usage: 'slide background' },
  text: { label: 'Text', usage: 'body text' },
  accent: { label: 'Accent', usage: 'titles and accents' },
  highlight: { label: 'Highlight', usage: 'highlight boxes' },
  chip: { label: 'Chip', usage: 'key word chips' },
  other: { label: 'Other', usage: 'also used' }
}

const KIND_NAME: Record<SlideKind, string> = {
  title: 'Title',
  'do-now': 'Do Now',
  objectives: 'Learning objectives',
  'key-words': 'Key words',
  content: 'Content',
  question: 'Question',
  activity: 'Activity',
  practical: 'Practical method',
  check: 'Check for understanding',
  plenary: 'Plenary',
  'exit-ticket': 'Exit ticket',
  quiz: 'Quiz',
  answers: 'Answers',
  section: 'Section break',
  custom: 'Other'
}

/** A readable name for a slide kind: "do-now" becomes "Do Now". */
export function slideKindName(kind: SlideKind): string {
  return KIND_NAME[kind]
}

/**
 * The live partial data after the first file is read. Colours are named by their role (the votes
 * carry no colour names); fonts the votes could not size or weigh get 400 and no range. Returns the
 * skeletons while no file has been learned.
 */
export function fromLearned(learned: LearnedSoFar): LearnedPanelData {
  if (learned.files === 0) return BUILDING
  return {
    colours: learned.colours.map((vote) => ({
      token: vote.role,
      hex: vote.hex,
      ...ROLE_LABEL[vote.role]
    })),
    fonts: learned.fonts.map((vote) => ({
      use: vote.use === 'other' ? 'accent' : vote.use,
      family: vote.family,
      weight: vote.weight ?? 400,
      sizeRangePt: vote.sizeRangePt,
      available: true,
      fallbackStack: `'${vote.family}', sans-serif`
    })),
    habits: learned.habits.map((habit) => habit.text),
    slideTypes: learned.slideKinds.map((vote) => slideKindName(vote.kind)),
    voiceRules: learned.voiceRules.map((rule) => rule.text)
  }
}
