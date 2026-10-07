import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { RichText } from './RichText'
import './MessageAssistant.css'

export interface MessageAssistantProps {
  /** Optional heading in the chat-title type ("What are we teaching?"). */
  heading?: string
  /** Claude's plain text: paragraphs, "-" bullets and **bold**. Shown as it streams in. */
  text?: string
  /** Draws each run of text (asset chips for `{{name}}`); without it the text is shown as it is. */
  renderInline?: (text: string) => ReactNode
  /** More text is still arriving: shows a blinking caret after the last word. */
  streaming?: boolean
  /** `error` explains what went wrong in a peach box. */
  variant?: 'normal' | 'error'
  /** The single action, usually "Try again". */
  action?: { label: string; onClick: () => void }
  /** What follows the text: ResultChip, AttachmentCard(s). */
  children?: ReactNode
  className?: string
}

/** The planning buddy's reply: no bubble, plain text, then the result chip and files. */
export function MessageAssistant({
  heading,
  text = '',
  renderInline,
  streaming = false,
  variant = 'normal',
  action,
  children,
  className
}: MessageAssistantProps) {
  const isError = variant === 'error'
  return (
    <div
      className={cx('ui-msg-a', className)}
      data-variant={variant}
      aria-busy={streaming || undefined}
    >
      {heading && <h3 className="ui-msg-a__heading">{heading}</h3>}
      {(text || streaming) && (
        <div className="ui-msg-a__text" data-streaming={streaming || undefined}>
          {isError && <CircleAlert size={18} aria-hidden="true" className="ui-msg-a__icon" />}
          <div className="ui-msg-a__body">
            {text ? <RichText text={text} renderInline={renderInline} /> : <p />}
          </div>
        </div>
      )}
      {action && (
        <div className="ui-msg-a__action">
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
      {children}
    </div>
  )
}
