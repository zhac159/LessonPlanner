import { useState } from 'react'
import type { ReviewBatch, ReviewFile } from '@shared/contracts/assets'
import { PICTURE_EXTENSIONS } from '../../shared'
import { ReviewFileRow, ReviewMoreRow } from '@ui/assets'
import { Callout, Card, Dropzone, TextLink } from '@ui/atoms'

export interface WhereILookedProps {
  batches: readonly ReviewBatch[]
  /** Files dropped on the small dropzone. */
  onFiles(files: File[]): void
  onBrowse(): void
  adding: boolean
  onThrowAway(): void
  /** "Try again" on a file that could not be read. */
  onRetry(batchId: string, fileId: string): void
}

const COLLAPSE_OVER = 4
const SHOWN = 3
const ACCEPT = [...PICTURE_EXTENSIONS.map((ext) => `.${ext}`), '.pdf', '.pptx']

/** "WHILE LEARNING SCIENCE KS3", "UPLOADED JUST NOW", "PICKED ONLINE". */
export function originLabel(origin: ReviewBatch['origin']): string {
  if (origin.kind === 'style') return `While learning ${origin.styleName}`
  return origin.kind === 'upload' ? 'Uploaded just now' : 'Picked online'
}

function progressOf(file: ReviewFile) {
  return file.progress
    ? {
        ...file.progress,
        label: `Cutting out pictures · page ${file.progress.done} of ${file.progress.total}`
      }
    : undefined
}

function BatchSection({
  batch,
  onRetry
}: {
  batch: ReviewBatch
  onRetry(batchId: string, fileId: string): void
}) {
  const [open, setOpen] = useState(false)
  const collapse = batch.files.length > COLLAPSE_OVER && !open
  const shown = collapse ? batch.files.slice(0, SHOWN) : batch.files
  const hidden = collapse ? batch.files.slice(SHOWN) : []
  return (
    <section className="as-looked__batch" aria-label={originLabel(batch.origin)}>
      <h3 className="as-looked__label">{originLabel(batch.origin)}</h3>
      <ul className="as-looked__files">
        {shown.map((file) => (
          <ReviewFileRow
            key={file.id}
            fileName={file.name}
            state={file.state}
            found={file.found}
            progress={progressOf(file)}
            error={file.error}
            onRetry={() => onRetry(batch.id, file.id)}
          />
        ))}
        {hidden.length > 0 && (
          <ReviewMoreRow
            count={hidden.length}
            found={hidden.reduce((sum, file) => sum + file.found, 0)}
            onToggle={() => setOpen(true)}
          />
        )}
      </ul>
    </section>
  )
}

/** The left card of A2: every batch with its files and progress, a small dropzone and the "what I leave out" note. */
export function WhereILooked({
  batches,
  onFiles,
  onBrowse,
  adding,
  onThrowAway,
  onRetry
}: WhereILookedProps) {
  return (
    <Card
      as="section"
      variant="page"
      padding={24}
      aria-label="Where I looked"
      className="as-looked"
    >
      <h2 className="as-looked__title">Where I looked</h2>
      {batches.map((batch) => (
        <BatchSection key={batch.id} batch={batch} onRetry={onRetry} />
      ))}
      <Dropzone
        variant="compact"
        title="Add images, a PDF or a PowerPoint"
        description="I’ll cut out each picture and name it"
        accept={ACCEPT}
        loading={adding}
        loadingLabel="Adding…"
        onFiles={onFiles}
        onBrowse={onBrowse}
      />
      <Callout variant="soft">
        I leave out photos that might show pupils, blurry pictures and repeats. Tick them if you
        want them anyway.
      </Callout>
      {batches.length > 0 && (
        <p className="as-looked__throw">
          <TextLink onClick={onThrowAway}>Throw these away</TextLink>
        </p>
      )}
    </Card>
  )
}
