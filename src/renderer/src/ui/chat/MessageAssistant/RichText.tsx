import { Fragment, type ReactNode } from 'react'
import { parseRichText, type Inline } from './parseRichText'

type RenderInline = (text: string) => ReactNode

function Inlines({ parts, render }: { parts: Inline[]; render?: RenderInline }) {
  return (
    <>
      {parts.map((part, i) => {
        const body = render ? render(part.text) : part.text
        return part.bold ? <strong key={i}>{body}</strong> : <Fragment key={i}>{body}</Fragment>
      })}
    </>
  )
}

/** Renders Claude's plain text as paragraphs, bullet lists and bold. Never as HTML. */
export function RichText({ text, renderInline }: { text: string; renderInline?: RenderInline }) {
  return (
    <>
      {parseRichText(text).map((block, i) =>
        block.type === 'ul' ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <Inlines parts={item} render={renderInline} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inlines parts={line} render={renderInline} />
              </Fragment>
            ))}
          </p>
        )
      )}
    </>
  )
}
