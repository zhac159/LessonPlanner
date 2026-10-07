/** Quiz questions: what Claude is asked for, the shape it answers in, and the checks before anything is made. */
import { z } from 'zod'
import { fail, ok, type Result } from '@shared/result'
import type { PluginInputs } from '@shared/plugins/inputs'

export type QuestionType = 'mcq' | 'tf' | 'gap' | 'short'
export type Destination = 'slides' | 'docx' | 'both'
export type Difficulty = 'mixed' | 'core' | 'stretch'

/** The validated options of a run. */
export interface QuizOptions {
  slides: 'all' | 'selected' | 'current'
  count: number
  types: QuestionType[]
  difficulty: Difficulty
  destination: Destination
}

export interface Question {
  type: QuestionType
  question: string
  /** Four options for multiple choice, empty otherwise. */
  options: string[]
  /** The correct option's text, "True" or "False", the missing word(s), or a model answer. */
  answer: string
  /** One sentence for the teacher; may be empty. */
  explanation: string
}

/** Wire schema: no optional fields, no open maps (empty string / array mean "not used"). */
export const quizSchema = z.object({
  questions: z.array(
    z.object({
      type: z.enum(['mcq', 'tf', 'gap', 'short']),
      question: z.string(),
      options: z.array(z.string()),
      answer: z.string(),
      explanation: z.string()
    })
  )
})

const optionsSchema = z.object({
  slides: z.enum(['all', 'selected', 'current']),
  count: z.number(),
  types: z.array(z.enum(['mcq', 'tf', 'gap', 'short'])),
  difficulty: z.enum(['mixed', 'core', 'stretch']),
  destination: z.enum(['slides', 'docx', 'both'])
})

/** The run's inputs (already validated against the manifest) as typed options. */
export function readOptions(inputs: PluginInputs): Result<{ options: QuizOptions }> {
  const parsed = optionsSchema.safeParse(inputs)
  return parsed.success
    ? ok({ options: parsed.data })
    : fail('invalid-input', 'The quiz options are not valid.')
}

export const QUIZ_INSTRUCTIONS = `You write quick-check quiz questions for a teacher, from the slides of her lesson.

Rules:
- Ask only about what the slides teach. Never invent facts. Use British English.
- Write for the year group and ability in the lesson details. Questions must be short and clear.
- Multiple choice ("mcq"): exactly four options, one correct; "answer" repeats the correct option's text exactly.
- True or false ("tf"): "options" is empty; "answer" is "True" or "False".
- Fill the gap ("gap"): put "_____" where the missing word goes, using her key words; "options" is empty; "answer" is the missing word(s).
- Short answer ("short"): "options" is empty; "answer" is a model answer of one sentence.
- "explanation" is one short sentence for the teacher, or an empty string.
- Spread the questions across the slides and mix the question types you were given.`

const GUIDE: Record<Difficulty, string> = {
  mixed: 'a mix: mostly core recall, some that need thinking',
  core: 'core recall and understanding for the whole class',
  stretch: 'harder questions that need explaining or applying ideas'
}

/** The volatile part of the request: the options and the slides' words. */
export function quizPrompt(
  options: QuizOptions,
  lesson: { title: string; yearGroup?: string; ability?: string },
  slideText: string
): string {
  const labels: Record<QuestionType, string> = {
    mcq: 'multiple choice',
    tf: 'true or false',
    gap: 'fill the gap',
    short: 'short answer'
  }
  const header = [
    `Lesson: ${lesson.title}`,
    lesson.yearGroup ? `Year group: ${lesson.yearGroup}` : '',
    lesson.ability ? `Ability: ${lesson.ability}` : '',
    `Write ${options.count} questions. Types to use: ${options.types.map((t) => labels[t]).join(', ')}.`,
    `Difficulty: ${GUIDE[options.difficulty]}.`
  ].filter(Boolean)
  return [...header, '', 'Slides:', slideText].join('\n')
}

const norm = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase()

/** Checks one question; returns the cleaned question, or undefined when it cannot be used. */
function clean(raw: Question, allowed: ReadonlySet<QuestionType>): Question | undefined {
  const question = raw.question.trim()
  const explanation = raw.explanation.trim()
  if (!question || !allowed.has(raw.type)) return undefined
  switch (raw.type) {
    case 'mcq': {
      const options = [...new Set(raw.options.map((o) => o.trim()).filter(Boolean))]
      const answer = options.find((o) => norm(o) === norm(raw.answer))
      return options.length >= 3 && options.length <= 5 && answer
        ? { type: 'mcq', question, options, answer, explanation }
        : undefined
    }
    case 'tf': {
      const answer = /^true$/i.test(raw.answer.trim())
        ? 'True'
        : /^false$/i.test(raw.answer.trim())
          ? 'False'
          : undefined
      return answer ? { type: 'tf', question, options: [], answer, explanation } : undefined
    }
    case 'gap':
      return /_{3,}/.test(question) && raw.answer.trim()
        ? { type: 'gap', question, options: [], answer: raw.answer.trim(), explanation }
        : undefined
    case 'short':
      return raw.answer.trim()
        ? { type: 'short', question, options: [], answer: raw.answer.trim(), explanation }
        : undefined
  }
}

export const NO_QUESTIONS = 'Claude didn’t write any questions I could use. Try again.'

/** Keeps the usable questions (at most `count`), dropping repeats of the same question. */
export function usableQuestions(
  raw: readonly Question[],
  options: Pick<QuizOptions, 'types' | 'count'>
): Result<{ questions: Question[]; dropped: number }> {
  const allowed = new Set(options.types)
  const seen = new Set<string>()
  const questions: Question[] = []
  for (const candidate of raw) {
    const cleaned = clean(candidate, allowed)
    if (!cleaned || seen.has(norm(cleaned.question))) continue
    seen.add(norm(cleaned.question))
    questions.push(cleaned)
  }
  const kept = questions.slice(0, options.count)
  return kept.length === 0
    ? fail('unknown', NO_QUESTIONS)
    : ok({ questions: kept, dropped: Math.max(0, options.count - kept.length) })
}
