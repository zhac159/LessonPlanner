import { stripUnresolvedDates } from '@shared/deck/dates'
import type { CSSProperties } from 'react'
import { resolveColor } from '@shared/deck/tokens'
import type { Paragraph, Run } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { BULLETS, isList, isListOnly, listNumbers } from '../paragraphs'

interface ParagraphsProps {
  paragraphs: readonly Paragraph[]
  style: StyleProfile | null
  /** Colour of checkbox glyphs (the profile's accent). */
  checkColor: string
}

function runStyle(run: Run, style: StyleProfile | null): CSSProperties | undefined {
  const css: CSSProperties = {}
  if (run.bold) css.fontWeight = 700
  if (run.italic) css.fontStyle = 'italic'
  if (run.underline) css.textDecoration = 'underline'
  if (run.color) css.color = resolveColor(run.color, style)
  return Object.keys(css).length ? css : undefined
}

function Marker({
  paragraph,
  number,
  checkColor
}: {
  paragraph: Paragraph
  number: number | null
  checkColor: string
}) {
  switch (paragraph.list) {
    case 'bullet':
      return (
        <span className="slide-para__marker" aria-hidden="true">
          {BULLETS[Math.min(paragraph.level ?? 0, 2)]}
        </span>
      )
    case 'number':
      return (
        <span className="slide-para__marker" aria-hidden="true">
          {number}.
        </span>
      )
    case 'checkbox':
      return (
        <span className="slide-para__marker" aria-hidden="true">
          <span className="slide-check" style={{ borderColor: checkColor }} />
        </span>
      )
    default:
      return null
  }
}

/** Paragraphs with their runs, list markers (bullet, number, tick-box) and indent levels. */
export function Paragraphs({ paragraphs, style, checkColor }: ParagraphsProps) {
  const numbers = listNumbers(paragraphs)
  const semantic = isListOnly(paragraphs)
  return (
    <>
      {paragraphs.map((paragraph, i) => {
        const listed = isList(paragraph)
        return (
          <div
            key={i}
            className="slide-para"
            role={semantic ? 'listitem' : undefined}
            style={{ paddingLeft: `${(paragraph.level ?? 0) * 1.4}em` }}
          >
            {listed && <Marker paragraph={paragraph} number={numbers[i]} checkColor={checkColor} />}
            <span className="slide-para__text">
              {paragraph.runs.map((run, j) => (
                <span key={j} style={runStyle(run, style)}>
                  {stripUnresolvedDates(run.text)}
                </span>
              ))}
            </span>
          </div>
        )
      })}
    </>
  )
}
