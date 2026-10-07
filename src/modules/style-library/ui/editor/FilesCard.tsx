import { Lock } from 'lucide-react'
import type { LearnProgress, StyleFile } from '@shared/contracts/style-library'
import { Callout, Card, Dropzone, ProgressBar } from '@ui/atoms'
import { STYLE_FILE_EXTENSIONS } from '../../shared'
import { ALL_FAILED, NAMES_WARNING, PRIVACY_NOTE, describePause } from '../model/messages'
import { allFailed, describeEta, describeFailures } from '../model/progressText'
import { FileList } from './FileList'
import { PauseCallout } from './PauseCallout'

export interface FilesCardProps {
  files: readonly StyleFile[]
  progress: LearnProgress
  adding: number
  compact: boolean
  onFiles: (files: File[]) => void
  onRejected: (files: File[]) => void
  onBrowse: () => void
  onRemove: (file: StyleFile) => void
  onRetry: (file: StyleFile) => void
  onResume: () => void
  onConnect: () => void
}

const plural = (n: number): string => `${n} ${n === 1 ? 'file' : 'files'}`

/** "Your files": the dropzone, the progress bar and every file's live status (04 §3, §5, §7). */
export function FilesCard({
  files,
  progress,
  adding,
  compact,
  onFiles,
  onRejected,
  onBrowse,
  onRemove,
  onRetry,
  onResume,
  onConnect
}: FilesCardProps) {
  const empty = files.length === 0
  const failures = describeFailures(progress)
  const pupilNames = files.some((file) => file.mayContainNames)
  const paused = progress.stage === 'paused'
  return (
    <Card as="section" shadow="lg" className="cs-files" aria-labelledby="cs-files-title">
      <div className="cs-files__title">
        <h2 id="cs-files-title">Your files</h2>
        {!empty && <span className="cs-files__count">{plural(files.length)}</span>}
      </div>
      {paused && (
        <PauseCallout
          copy={describePause(progress.pausedFor)}
          onResume={onResume}
          onConnect={onConnect}
        />
      )}
      <Dropzone
        variant="compact"
        className={empty ? 'cs-files__drop cs-files__drop--empty' : 'cs-files__drop'}
        title={empty ? 'Add your PDFs or PowerPoints' : 'Add more PDFs or PowerPoints'}
        description="Drop files here, or browse"
        accept={STYLE_FILE_EXTENSIONS}
        onFiles={onFiles}
        onRejected={onRejected}
        onBrowse={onBrowse}
        loading={adding > 0}
        loadingLabel={`Adding ${plural(adding)}…`}
      />
      {!empty && (
        <ProgressBar
          value={progress.learned + progress.failed}
          max={progress.total}
          label={`${progress.learned} of ${progress.total} learned`}
          estimate={describeEta(progress)}
        />
      )}
      {failures && <p className="cs-files__failures">{failures}</p>}
      {allFailed(progress) && <Callout variant="error">{ALL_FAILED}</Callout>}
      {pupilNames && <Callout variant="warning">{NAMES_WARNING}</Callout>}
      {!empty && <FileList files={files} compact={compact} onRemove={onRemove} onRetry={onRetry} />}
      <Callout variant="soft">
        <strong>Tip:</strong> 10 or more decks gives the closest match. Mix recent favourites with a
        few older lessons.
      </Callout>
      <p className="cs-files__privacy">
        <Lock size={14} aria-hidden="true" />
        <span>{PRIVACY_NOTE}</span>
      </p>
    </Card>
  )
}
