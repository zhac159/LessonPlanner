import { RotateCcw, TriangleAlert, X } from 'lucide-react'
import type { StyleFile } from '@shared/contracts/style-library'
import {
  FileTypeBadge,
  IconButton,
  StatusPill,
  Tooltip,
  cx,
  type StatusPillProps
} from '../../atoms'
import './StyleFileRow.css'

export interface StyleFileRowProps {
  file: StyleFile
  /** The × button. The row is not removable when omitted. */
  onRemove?: (file: StyleFile) => void
  /** The retry button, shown only for a failed file whose error is `retryable`. */
  onRetry?: (file: StyleFile) => void
  className?: string
}

const STATUS: Record<StyleFile['status'], { label: string; pill: Partial<StatusPillProps> }> = {
  waiting: { label: 'Waiting', pill: { tone: 'waiting' } },
  reading: { label: 'Reading…', pill: { tone: 'tag', color: 'var(--status-working)' } },
  learned: { label: 'Learned', pill: { tone: 'done' } },
  failed: { label: 'Couldn’t read', pill: { tone: 'error' } }
}

/** "14 slides" / "18 pages" (singular for one); blank until the file has been counted. */
export function describeFileSize(file: Pick<StyleFile, 'kind' | 'units'>): string {
  if (file.units === null) return ''
  const noun = file.kind === 'pptx' ? 'slide' : 'page'
  return `${file.units} ${noun}${file.units === 1 ? '' : 's'}`
}

/**
 * One file in the "Your files" queue: type badge, name, size or failure reason, status pill and a
 * remove button. Renders an `li`: put it inside a `ul`.
 */
export function StyleFileRow({ file, onRemove, onRetry, className }: StyleFileRowProps) {
  const status = STATUS[file.status]
  const failure = file.status === 'failed' ? file.error : undefined
  const detail = failure ? failure.message : describeFileSize(file)
  const canRetry = Boolean(failure?.retryable && onRetry)
  const pill = (
    <StatusPill size="sm" {...status.pill}>
      {status.label}
    </StatusPill>
  )

  return (
    <li className={cx('style-file-row', className)} data-status={file.status}>
      <FileTypeBadge kind={file.kind} />
      <span className="style-file-row__text">
        <span className="style-file-row__name" title={file.name}>
          {file.name}
        </span>
        {failure ? (
          // A failure needs room for its reason, so the pill moves under the name beside it.
          <span className="style-file-row__failure">
            {pill}
            <span className="style-file-row__detail is-error">{detail}</span>
          </span>
        ) : (
          detail && <span className="style-file-row__detail">{detail}</span>
        )}
      </span>
      {file.mayContainNames && (
        <Tooltip label="May contain pupil names">
          <span
            className="style-file-row__warning"
            role="img"
            aria-label="May contain pupil names"
            tabIndex={0}
          >
            <TriangleAlert size={18} aria-hidden="true" />
          </span>
        </Tooltip>
      )}
      {!failure && pill}
      {canRetry && (
        <IconButton
          variant="ghost"
          aria-label={`Try ${file.name} again`}
          onClick={() => onRetry?.(file)}
        >
          <RotateCcw size={16} />
        </IconButton>
      )}
      {onRemove && (
        <IconButton
          variant="ghost"
          aria-label={`Remove ${file.name}`}
          onClick={() => onRemove(file)}
        >
          <X size={16} />
        </IconButton>
      )}
    </li>
  )
}
