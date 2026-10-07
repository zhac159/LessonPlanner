import { cx } from '../cx'
import './FileTypeBadge.css'

export type FileKind = 'pdf' | 'pptx' | 'docx' | 'file'

/** Classify a file name by extension: unknown extensions are plain `file`. */
export function fileKindOf(name: string): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  return ext === 'pdf' || ext === 'pptx' || ext === 'docx' ? ext : 'file'
}

export interface FileTypeBadgeProps {
  /** Either a kind, or a file name to classify. */
  kind?: FileKind
  fileName?: string
  className?: string
}

/** 48×40 tile with the file's type in capitals: PDF peach, PPTX sky, DOCX mint, other white. */
export function FileTypeBadge({ kind, fileName, className }: FileTypeBadgeProps) {
  const resolved = kind ?? (fileName ? fileKindOf(fileName) : 'file')
  return (
    <span className={cx('ui-file-badge', className)} data-kind={resolved}>
      {resolved}
    </span>
  )
}
