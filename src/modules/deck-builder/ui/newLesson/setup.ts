/**
 * The "Lesson set-up" chips of the New lesson screen (05 §5, §8.2, §8.4): the choices, the slide-count
 * rule and a reducer that remembers who set each chip (a default, a guess from the typed text, or the
 * teacher) so a guess never overwrites her choice and a default never overwrites a guess.
 * Pure TypeScript: no React.
 */

export const YEAR_GROUPS = [
  'Year 7',
  'Year 8',
  'Year 9',
  'Year 10',
  'Year 11',
  'Year 12',
  'Year 13',
  'Form time'
] as const

export const LENGTHS_MIN = [30, 40, 45, 50, 60, 75, 90] as const
export const ABILITIES = ['Mixed ability', 'Higher ability', 'Lower ability'] as const
export const SLIDE_COUNTS = [6, 8, 10, 12, 15] as const

export const DEFAULT_LENGTH_MIN = 50
export const DEFAULT_ABILITY: string = ABILITIES[0]

/** The slide count that follows a lesson length until the teacher picks one (05 §8.4). */
export function slideCountForLength(minutes: number): number {
  if (minutes <= 40) return 6
  if (minutes <= 50) return 8
  if (minutes <= 60) return 10
  if (minutes <= 75) return 12
  return 15
}

export type ChipKey = 'year' | 'length' | 'ability' | 'slides'
/** Who set a chip: the app (a default), a guess from the text, or the teacher. */
export type ChipSource = 'default' | 'detected' | 'user'

export interface LessonSetup {
  /** "Year 8"; null until chosen (the chip reads "Year group"). */
  yearGroup: string | null
  durationMin: number
  ability: string
  slideCount: number
}

export interface SetupState {
  values: LessonSetup
  sources: Record<ChipKey, ChipSource>
}

export type SetupAction =
  | {
      type: 'defaults'
      yearGroup?: string | null
      durationMin?: number | null
      ability?: string | null
    }
  | { type: 'detected'; yearGroup?: string | null; durationMin?: number | null }
  | { type: 'user'; key: ChipKey; value: string | number }

export const initialSetup = (): SetupState => ({
  values: {
    yearGroup: null,
    durationMin: DEFAULT_LENGTH_MIN,
    ability: DEFAULT_ABILITY,
    slideCount: slideCountForLength(DEFAULT_LENGTH_MIN)
  },
  sources: { year: 'default', length: 'default', ability: 'default', slides: 'default' }
})

/** Sets the length and, while the slide count is not the teacher's choice, lets the count follow it. */
function withLength(state: SetupState, durationMin: number, source: ChipSource): SetupState {
  const follows = state.sources.slides !== 'user'
  return {
    values: {
      ...state.values,
      durationMin,
      slideCount: follows ? slideCountForLength(durationMin) : state.values.slideCount
    },
    sources: { ...state.sources, length: source }
  }
}

/** Applies one change; `defaults` only fill chips still on their default, `detected` skip the teacher's. */
export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'defaults': {
      let next = state
      if (action.yearGroup && state.sources.year === 'default') {
        next = {
          values: { ...next.values, yearGroup: action.yearGroup },
          sources: { ...next.sources, year: 'default' }
        }
      }
      if (action.durationMin && next.sources.length === 'default') {
        next = withLength(next, action.durationMin, 'default')
      }
      if (action.ability && next.sources.ability === 'default') {
        next = { ...next, values: { ...next.values, ability: action.ability } }
      }
      return next
    }
    case 'detected': {
      let next = state
      if (action.yearGroup && state.sources.year !== 'user') {
        if (action.yearGroup !== state.values.yearGroup || state.sources.year !== 'detected') {
          next = {
            values: { ...next.values, yearGroup: action.yearGroup },
            sources: { ...next.sources, year: 'detected' }
          }
        }
      }
      if (action.durationMin && next.sources.length !== 'user') {
        if (action.durationMin !== next.values.durationMin || next.sources.length !== 'detected') {
          next = withLength(next, action.durationMin, 'detected')
        }
      }
      return next
    }
    case 'user': {
      const sources = { ...state.sources, [action.key]: 'user' as const }
      switch (action.key) {
        case 'year':
          return { values: { ...state.values, yearGroup: String(action.value) }, sources }
        case 'ability':
          return { values: { ...state.values, ability: String(action.value) }, sources }
        case 'slides':
          return { values: { ...state.values, slideCount: Number(action.value) }, sources }
        case 'length':
          return withLength(state, Number(action.value), 'user')
      }
    }
  }
}

/** "Year 8 · 50 min · Mixed ability · About 8 slides" (05 §5): the line under her message. */
export function setupSummary(setup: LessonSetup): string {
  return [
    setup.yearGroup,
    `${setup.durationMin} min`,
    setup.ability,
    `About ${setup.slideCount} slides`
  ]
    .filter(Boolean)
    .join(' · ')
}
