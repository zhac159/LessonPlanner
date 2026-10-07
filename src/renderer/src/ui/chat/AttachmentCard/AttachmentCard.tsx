import { File, FileText, FolderOpen, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { ProgressDots } from '../../atoms/ProgressDots/ProgressDots'
import { StatusPill } from '../../atoms/StatusPill/StatusPill'
import { attachmentKindOf, fileTypeLabel, formatFileSize, type AttachmentKind } from '../format'
import './AttachmentCard.css'

export interface AttachmentCardProps {
  /** File name, shown in bold and ellipsised when long. */
  name: string
  sizeBytes?: number
  /** Defaults to a guess from the file name's extension. */
  kind?: AttachmentKind
  /** `uploading` and `reading` show dots; `error` shows an error pill instead of the type line. */
  status?: 'ready' | 'uploading' | 'reading' | 'error'
  /** Replaces the type line when ready or reading, e.g. "3 objectives found". */
  detail?: string
  /** Wording of the error pill. */
  errorText?: string
  /** `file-text` for worksheets, `file` otherwise. */
  icon?: 'file' | 'file-text'
  /** Adds an "Open" button (a file the buddy made). */
  onOpen?: () => void
  /** Adds a "Show in folder" button. */
  onShowInFolder?: () => void
  /** Adds a remove × (a file staged in the Composer). */
  onRemove?: () => void
  className?: string
}

function TypeLine({
  status,
  detail,
  typeText,
  errorText
}: {
  status: NonNullable<AttachmentCardProps['status']>
  detail?: string
  typeText: string
  errorText: string
}) {
  if (status === 'error') {
    return (
      <StatusPill tone="error" size="sm">
        {errorText}
      </StatusPill>
    )
  }
  const text =
    status === 'uploading'
      ? 'Uploading…'
      : (detail ?? (status === 'reading' ? 'Reading…' : typeText))
  return (
    <span className="ui-attach__type">
      {text}
      {status !== 'ready' && <ProgressDots size="sm" />}
    </span>
  )
}

/** A file in the chat: her upload, a staged file in the Composer, or a file a plugin made. */
export function AttachmentCard({
  name,
  sizeBytes,
  kind,
  status = 'ready',
  detail,
  errorText = 'Couldn’t read this file',
  icon = 'file',
  onOpen,
  onShowInFolder,
  onRemove,
  className
}: AttachmentCardProps) {
  const resolved = kind ?? attachmentKindOf(name)
  const size = sizeBytes === undefined ? '' : formatFileSize(sizeBytes)
  const typeText = size ? `${fileTypeLabel(resolved)} · ${size}` : fileTypeLabel(resolved)
  const Icon = resolved === 'image' ? ImageIcon : icon === 'file-text' ? FileText : File
  return (
    <div className={cx('ui-attach', className)} role="group" aria-label={name}>
      <span className="ui-attach__tile" data-kind={resolved} aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="ui-attach__text">
        <span className="ui-attach__name" title={name}>
          {name}
        </span>
        <TypeLine status={status} detail={detail} typeText={typeText} errorText={errorText} />
      </span>
      {(onOpen || onShowInFolder) && (
        <span className="ui-attach__actions">
          {onOpen && (
            <Button size="sm" onClick={onOpen}>
              Open
            </Button>
          )}
          {onShowInFolder && (
            <Button size="sm" icon={<FolderOpen />} onClick={onShowInFolder}>
              Show in folder
            </Button>
          )}
        </span>
      )}
      {onRemove && (
        <IconButton variant="ghost" aria-label={`Remove ${name}`} onClick={onRemove}>
          <X strokeWidth={2.2} />
        </IconButton>
      )}
    </div>
  )
}
