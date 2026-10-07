/** The printable quiz: an A4 portrait sheet of questions and, on its own page, the answer key. */
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { StyleProfile } from '@shared/style/types'
import type { Question } from './questions'
import { answerText } from './slides'

const A4 = { width: 11906, height: 16838 }
const MARGIN = 1134
const LETTERS = 'ABCDE'
const HALF_POINTS = 24

const lineOf = (text: string, over: { bold?: boolean; italics?: boolean } = {}): TextRun =>
  new TextRun({ text, ...over })

function questionParagraphs(question: Question, number: number): Paragraph[] {
  const paragraphs = [
    new Paragraph({
      spacing: { before: 240, after: 80 },
      keepNext: true,
      children: [lineOf(`${number}. ${question.question}`, { bold: true })]
    })
  ]
  const indented = (text: string): Paragraph =>
    new Paragraph({ indent: { left: 567 }, spacing: { after: 40 }, children: [lineOf(text)] })
  if (question.type === 'mcq')
    question.options.forEach((o, i) => paragraphs.push(indented(`${LETTERS[i]}   ${o}`)))
  if (question.type === 'tf') paragraphs.push(indented('True  /  False'))
  if (question.type === 'short') {
    paragraphs.push(indented('_'.repeat(70)), indented('_'.repeat(70)))
  }
  return paragraphs
}

/** The quiz as a Word document (bytes of a .docx). Uses the style's body font. */
export async function buildQuizDocx(input: {
  lessonTitle: string
  questions: readonly Question[]
  style: StyleProfile | null
}): Promise<Uint8Array> {
  const { lessonTitle, questions } = input
  const title = `${lessonTitle} quiz`
  const font = input.style?.tokens.fonts.body.family ?? 'Calibri'
  const page = { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }

  const sheet = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [lineOf(title)] }),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        lineOf(
          `Name: ${'_'.repeat(28)}     Date: ${'_'.repeat(14)}     Score: ____ / ${questions.length}`
        )
      ]
    }),
    ...questions.flatMap((q, i) => questionParagraphs(q, i + 1))
  ]
  const key = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [lineOf(`${title}: answer key`)] }),
    ...questions.flatMap((q, i) => [
      new Paragraph({
        spacing: { before: 120, after: 40 },
        alignment: AlignmentType.LEFT,
        children: [lineOf(answerText(q, i + 1), { bold: true })]
      }),
      ...(q.explanation
        ? [
            new Paragraph({
              indent: { left: 567 },
              children: [lineOf(q.explanation, { italics: true })]
            })
          ]
        : [])
    ])
  ]
  const doc = new Document({
    creator: 'Slide Planner',
    title,
    styles: { default: { document: { run: { font, size: HALF_POINTS } } } },
    sections: [
      { properties: { page }, children: sheet },
      { properties: { page }, children: key }
    ]
  })
  return Packer.toBuffer(doc)
}
