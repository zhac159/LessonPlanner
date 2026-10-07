import type { ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { StatusPill } from '../../atoms/StatusPill/StatusPill'
import { AttachmentCard, type AttachmentCardProps } from '../AttachmentCard/AttachmentCard'
import { RegionChip, type RegionChipProps } from '../RegionChip/RegionChip'
import './MessageUser.css'

export interface MessageUserProps {
  /** Her words. Shown as typed (line breaks kept), never as HTML. */
  text?: string
  /** Draws the text (asset chips for `{{name}}`); without it the text is shown as typed. */
  renderText?: (text: string) => ReactNode
  attachments?: Array<AttachmentCardProps & { id: string }>
  regions?: Array<RegionChipProps & { id: string }>
  /** A muted line under the text, e.g. "Year 8 · 50 min · Mixed ability · About 8 slides". */
  note?: string
  /** The message was not sent: adds a "Not sent" pill and a "Try again" button. */
  failed?: boolean
  onRetry?: () => void
  className?: string
}

/** Her message: a lilac bubble on the right with attachments and region chips above the text. */
export function MessageUser({
  text,
  renderText,
  attachments = [],
  regions = [],
  note,
  failed = false,
  onRetry,
  className
}: MessageUserProps) {
  const chipsOnly = attachments.length === 0 && regions.length > 0
  return (
    <div className={cx('ui-msg-u', className)} data-compact={chipsOnly || undefined}>
      {attachments.map(({ id, ...card }) => (
        <AttachmentCard key={id} {...card} />
      ))}
      {regions.map(({ id, ...chip }) => (
        <RegionChip key={id} {...chip} />
      ))}
      {text && <p className="ui-msg-u__text">{renderText ? renderText(text) : text}</p>}
      {note && <p className="ui-msg-u__note">{note}</p>}
      {failed && (
        <div className="ui-msg-u__failed">
          <StatusPill tone="error">Not sent</StatusPill>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
