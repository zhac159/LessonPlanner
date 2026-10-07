/** The quiz as slides on the lesson's own layouts: question slides (3 questions each) and answer slides. */
import type { Deck, Paragraph, Slide } from '@shared/deck/types'
import { buildTextSlide } from '@shared/plugins/slides'
import type { StyleProfile } from '@shared/style/types'
import type { Question } from './questions'

export const QUESTIONS_PER_SLIDE = 3
export const ANSWERS_PER_SLIDE = 8
const LETTERS = 'ABCDE'

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  )

const range = (from: number, to: number): string => (from === to ? `${from}` : `${from}–${to}`)

const line = (text: string, level: 0 | 1 = 0, bold = false): Paragraph => ({
  list: 'none',
  level,
  runs: [{ text, ...(bold ? { bold: true } : {}) }]
})

/** One question as paragraphs: the numbered question, then its options on one line for multiple choice. */
function questionLines(question: Question, number: number): Paragraph[] {
  const lines = [line(`${number}. ${question.question}`, 0, true)]
  if (question.type === 'mcq')
    lines.push(line(question.options.map((o, i) => `${LETTERS[i]}  ${o}`).join('     '), 1))
  if (question.type === 'tf') lines.push(line('True  /  False', 1))
  return lines
}

/** The answer line of one question ("3. B  Chloroplasts"). */
export function answerText(question: Question, number: number): string {
  if (question.type !== 'mcq') return `${number}. ${question.answer}`
  const letter = LETTERS[question.options.indexOf(question.answer)]
  return `${number}. ${letter}  ${question.answer}`
}

/** The quiz slides followed by the answer slides, ready to insert. `newId` makes the slide ids. */
export function buildQuizSlides(input: {
  questions: readonly Question[]
  style: StyleProfile | null
  deck: Pick<Deck, 'slides'>
  newId: (prefix: string) => string
  pluginId: string
}): Slide[] {
  const { questions, style, deck, newId, pluginId } = input
  const made: Slide[] = []
  chunk(questions, QUESTIONS_PER_SLIDE).forEach((group, g) => {
    const first = g * QUESTIONS_PER_SLIDE + 1
    made.push(
      buildTextSlide(
        {
          id: newId('sld'),
          kind: 'quiz',
          kicker: `Quiz · Questions ${range(first, first + group.length - 1)}`,
          title: 'Quick quiz',
          body: group.flatMap((q, i) => questionLines(q, first + i)),
          pluginId
        },
        style,
        deck
      )
    )
  })
  chunk(questions, ANSWERS_PER_SLIDE).forEach((group, g) => {
    const first = g * ANSWERS_PER_SLIDE + 1
    const notes = group
      .map((q, i) => (q.explanation ? `${first + i}. ${q.explanation}` : ''))
      .filter(Boolean)
      .join('\n')
    made.push(
      buildTextSlide(
        {
          id: newId('sld'),
          kind: 'answers',
          kicker:
            questions.length > ANSWERS_PER_SLIDE
              ? `Quiz · Answers ${range(first, first + group.length - 1)}`
              : 'Quiz · Answers',
          title: 'Quiz answers',
          body: group.map((q, i) => line(answerText(q, first + i))),
          ...(notes ? { notes } : {}),
          pluginId
        },
        style,
        deck
      )
    )
  })
  return made
}
