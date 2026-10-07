/**
 * Renders the app's data into prompt text, and assembles the system prompt in cache order
 * ([A] task instructions + [B] deck model, then [C] style profile). Deterministic: the same data always yields
 * the same bytes (stable key order), otherwise the prompt cache would never hit.
 */
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import type { StyleProfile } from '@shared/style/types'
import { stableStringify } from '../json'
import type { SystemPart } from '../request'
import { DECK_MODEL } from './deckModel'

/** The profile as the model should see it: no ids, dates, versions or source bookkeeping (they churn the cache). */
const VOLATILE_PROFILE_KEYS = new Set([
  'id',
  'version',
  'isDefault',
  'status',
  'sources',
  'createdAt',
  'updatedAt'
])

export function profileForPrompt(profile: StyleProfile): unknown {
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => !VOLATILE_PROFILE_KEYS.has(key))
  )
}

export const NO_PROFILE_TEXT =
  'No style profile yet: use a clean, simple default style. Colour tokens: background, text, accent, accent2, highlight, chipBg, chipText, muted, placeholder. Leave layoutId empty.'

export function profileText(profile: StyleProfile | null | undefined): string {
  return profile
    ? `# Style profile (her style: follow it exactly)\n${stableStringify(profileForPrompt(profile))}`
    : `# Style profile\n${NO_PROFILE_TEXT}`
}

export interface SystemOptions {
  /** [A] The task's instructions. */
  instructions: string[]
  /** Include [B] the deck model summary. */
  deckModel?: boolean
  /** [C] undefined = leave out; null = "no profile yet". */
  profile?: StyleProfile | null
  /** [C2] the teacher's assets block (`buildAssetCatalogue().text`); empty or undefined = leave out. */
  assets?: string
}

/** [A]+[B] in one block with breakpoint 1, then [C] with breakpoint 2, then the assets block (§3). */
export function buildSystem({
  instructions,
  deckModel,
  profile,
  assets
}: SystemOptions): SystemPart[] {
  const head = [...instructions, ...(deckModel ? [DECK_MODEL] : [])].join('\n\n')
  const parts: SystemPart[] = [{ text: head, cache: true }]
  if (profile !== undefined) parts.push({ text: profileText(profile), cache: true })
  // Its own part: the library changes often, so it must not break the cache of the head and the profile.
  if (assets) parts.push({ text: assets, cache: true })
  return parts
}

/** [D] lesson meta + objectives, as text. */
export function briefText(brief: LessonBrief): string {
  const lines = [
    '# Lesson',
    brief.title ? `Title: ${brief.title}` : '',
    brief.subject ? `Subject: ${brief.subject}` : '',
    brief.yearGroup ? `Year group: ${brief.yearGroup}` : '',
    brief.durationMin ? `Duration: ${brief.durationMin} minutes` : '',
    brief.ability ? `Ability: ${brief.ability}` : '',
    brief.targetSlideCount ? `Target slide count: ${brief.targetSlideCount}` : '',
    'Learning objectives (0-based index, then text):',
    ...brief.objectives.map((objective, i) => `${i}. ${objective}`),
    brief.context ? `Context from the teacher: ${brief.context}` : ''
  ]
  return lines.filter(Boolean).join('\n')
}

export function planText(plan: LessonPlan): string {
  return `# Lesson plan (all slides)\n${stableStringify(plan)}`
}
