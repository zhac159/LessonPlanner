import { ArrowUpFromLine, FileUp, LoaderCircle } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { cx } from '../cx'
import { dropMessage, isDragAcceptable, onlyMessage, splitByExtension } from './files'
import './Dropzone.css'

type DragState = { kind: 'idle' } | { kind: 'valid'; count: number } | { kind: 'invalid' }

export interface DropzoneProps {
  /** large = Home column, compact = row under a file list, chat = inside the chat. */
  variant?: 'large' | 'compact' | 'chat'
  /** Heading line, e.g. "Create a new style". */
  title: string
  /** Second line. Wrap a call to action in `<span className="ui-dropzone__link">browse files</span>`. */
  description?: ReactNode
  /** Small print, e.g. ".pdf and .pptx · up to 50 files". */
  meta?: string
  /** Accepted extensions, e.g. ['.pdf', '.pptx']. Others go to `onRejected`. Empty = anything. */
  accept?: ReadonlyArray<string>
  /** Dropped files that match `accept`. Not called for an empty list. */
  onFiles: (files: File[]) => void
  /** Dropped files that do not match `accept`. */
  onRejected?: (files: File[]) => void
  /** Click, Enter or Space: open the native file picker. */
  onBrowse: () => void
  /** Limit reached: dashed grey, not clickable. */
  disabled?: boolean
  /** Files are being added: spinner and `loadingLabel`. */
  loading?: boolean
  /** Title while loading, e.g. "Adding 3 files…". */
  loadingLabel?: string
  className?: string
}

const typesOf = (event: DragEvent): string[] =>
  Array.from(event.dataTransfer?.items ?? [], (item) => item.type)

/** Click-or-drop target for files. A real button, so Enter and Space open the picker. */
export function Dropzone({
  variant = 'large',
  title,
  description,
  meta,
  accept,
  onFiles,
  onRejected,
  onBrowse,
  disabled = false,
  loading = false,
  loadingLabel = 'Adding files…',
  className
}: DropzoneProps) {
  const [drag, setDrag] = useState<DragState>({ kind: 'idle' })
  // dragenter/dragleave also fire for child elements: count them so the state does not flicker.
  const depth = useRef(0)
  const inert = disabled || loading

  const reset = (): void => {
    depth.current = 0
    setDrag({ kind: 'idle' })
  }

  const onDragEnter = (event: DragEvent): void => {
    if (inert) return
    event.preventDefault()
    depth.current += 1
    const items = event.dataTransfer?.items
    const count = items?.length ?? event.dataTransfer?.files?.length ?? 0
    setDrag(
      isDragAcceptable(typesOf(event), accept)
        ? { kind: 'valid', count: Math.max(count, 1) }
        : { kind: 'invalid' }
    )
  }

  const onDragOver = (event: DragEvent): void => {
    if (!inert) event.preventDefault()
  }

  const onDragLeave = (): void => {
    depth.current = Math.max(depth.current - 1, 0)
    if (depth.current === 0) setDrag({ kind: 'idle' })
  }

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    reset()
    if (inert) return
    const { accepted, rejected } = splitByExtension(
      Array.from(event.dataTransfer?.files ?? []),
      accept
    )
    if (accepted.length > 0) onFiles(accepted)
    if (rejected.length > 0) onRejected?.(rejected)
  }

  const shownTitle = loading
    ? loadingLabel
    : drag.kind === 'valid'
      ? dropMessage(drag.count)
      : drag.kind === 'invalid'
        ? onlyMessage(accept ?? [])
        : title

  const icon = loading ? (
    <LoaderCircle className="ui-dropzone__spinner" size={variant === 'large' ? 22 : 18} />
  ) : variant === 'large' ? (
    <ArrowUpFromLine size={22} strokeWidth={2.2} />
  ) : variant === 'compact' ? (
    <ArrowUpFromLine size={18} strokeWidth={2.2} />
  ) : (
    <FileUp size={26} strokeWidth={2} />
  )

  return (
    <button
      type="button"
      className={cx('ui-dropzone', className)}
      data-variant={variant}
      data-drag={drag.kind}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={() => !inert && onBrowse()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="ui-dropzone__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ui-dropzone__text">
        <span className="ui-dropzone__title" aria-live="polite">
          {shownTitle}
        </span>
        {description && <span className="ui-dropzone__description">{description}</span>}
        {meta && <span className="ui-dropzone__meta">{meta}</span>}
      </span>
    </button>
  )
}
