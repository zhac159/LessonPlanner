import { useState } from 'react'
import type { StyleFile } from '@shared/contracts/style-library'
import { StyleFileRow } from '@ui/style'

/** Rows shown before "Show all" when the two cards are stacked. */
export const STACKED_ROWS = 5

export interface FileListProps {
  files: readonly StyleFile[]
  /** The cards are stacked: show only the first rows and a "Show all" toggle. */
  compact: boolean
  onRemove: (file: StyleFile) => void
  onRetry: (file: StyleFile) => void
}

/** The queue, in order. Long lists are shortened when the learned panel would be pushed far down. */
export function FileList({ files, compact, onRemove, onRetry }: FileListProps) {
  const [showAll, setShowAll] = useState(false)
  const shorten = compact && files.length > STACKED_ROWS && !showAll
  const visible = shorten ? files.slice(0, STACKED_ROWS) : files
  return (
    <>
      <ul className="cs-files__list" aria-label="Your files">
        {visible.map((file) => (
          <StyleFileRow key={file.id} file={file} onRemove={onRemove} onRetry={onRetry} />
        ))}
      </ul>
      {compact && files.length > STACKED_ROWS && (
        <button
          type="button"
          className="cs-link-button"
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? 'Show fewer files' : `Show all ${files.length} files`}
        </button>
      )}
    </>
  )
}
