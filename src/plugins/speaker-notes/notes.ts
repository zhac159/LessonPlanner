/** Speaker notes: the request to Claude, its answer's shape and the checks before notes are written to slides. */
import { z } from 'zod'
import type { PluginInputs } from '@shared/plugins/inputs'
import { fail, ok, type Result } from '@shared/result'

export interface NotesOptions {
  slides: 'all' | 'selected' | 'current'
  length: 'short' | 'full'
  timings: boolean
}

const optionsSchema = z.object({
  slides: z.enum(['all', 'selected', 'current']),
  length: z.enum(['short', 'full']),
  timings: z.boolean()
})

/** The run's inputs (already validated against the manifest) as typed options. */
export function readOptions(inputs: PluginInputs): Result<{ options: NotesOptions }> {
  const parsed = optionsSchema.safeParse(inputs)
  return parsed.success
    ? ok({ options: parsed.data })
    : fail('invalid-input', 'The speaker notes options are not valid.')
}

/** Wire schema: one entry per slide, no optional fields. */
export const notesSchema = z.object({
  notes: z.array(z.object({ slideId: z.string(), text: z.string() }))
})

export const NOTES_INSTRUCTIONS = `You write speaker notes for a teacher's lesson slides, in the teacher's own voice.

Rules:
- One entry per slide you are given, using the slide's id exactly. Never invent facts. Use British English.
- Say what to do and say on that slide, the likely misconceptions to listen for, and a question to ask.
- Plain text only, no markdown. Separate sentences with spaces; use a new line only between separate points.
- Follow the voice rules in the style profile when there is one.`

const LENGTH: Record<NotesOptions['length'], string> = {
  short: 'Keep each slide to one or two sentences.',
  full: 'Write two to four sentences per slide, including a question to ask the class.'
}

/** The volatile part of the request. */
export function notesPrompt(
  options: NotesOptions,
  lesson: { title: string; yearGroup?: string; durationMin?: number },
  slideText: string
): string {
  const header = [
    `Lesson: ${lesson.title}`,
    lesson.yearGroup ? `Year group: ${lesson.yearGroup}` : '',
    lesson.durationMin ? `Lesson length: ${lesson.durationMin} minutes` : '',
    LENGTH[options.length],
    options.timings
      ? 'Start each note with how long to spend on the slide, e.g. "3 minutes."'
      : 'Do not mention timings.'
  ].filter(Boolean)
  return [...header, '', 'Slides:', slideText].join('\n')
}

export const NO_NOTES = 'Claude didn’t write any notes I could use. Try again.'

/** Notes for the slides that were asked for, as `slideId -> text`. Unknown ids and empty notes are dropped. */
export function usableNotes(
  raw: ReadonlyArray<{ slideId: string; text: string }>,
  slideIds: readonly string[]
): Result<{ notes: Map<string, string> }> {
  const wanted = new Set(slideIds)
  const notes = new Map<string, string>()
  for (const { slideId, text } of raw) {
    const clean = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    if (wanted.has(slideId) && clean && !notes.has(slideId)) notes.set(slideId, clean)
  }
  return notes.size === 0 ? fail('unknown', NO_NOTES) : ok({ notes })
}
