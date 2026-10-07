import { FileWarning } from 'lucide-react'
import { Button, Callout, EmptyState } from '@ui/atoms'
import './LessonStates.css'

/** "This lesson couldn’t be opened." in place of stage and chat (06 §7: corrupt or missing lesson). */
export function LessonLoadError({ onBack }: { onBack(): void }) {
  return (
    <div className="lesson-error" role="alert">
      <EmptyState
        variant="list"
        icon={<FileWarning strokeWidth={2} />}
        title="This lesson couldn’t be opened."
        actions={
          <Button variant="primary" onClick={onBack}>
            Back to Home
          </Button>
        }
      />
    </div>
  )
}

/**
 * Skeletons of the stage, filmstrip and transcript while the lesson loads (06 §7). They fade in after 300 ms, so a
 * quick open shows nothing extra.
 */
export function EditorSkeleton() {
  return (
    <div className="editor-skeleton" role="status" aria-label="Opening your lesson">
      <div className="editor-skeleton__stage" />
      <div className="editor-skeleton__strip">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="editor-skeleton__thumb" />
        ))}
      </div>
    </div>
  )
}

/** The editor chat column while the lesson loads: two grey bubbles. */
export function ChatSkeleton() {
  return (
    <div className="editor-skeleton editor-skeleton--chat" aria-hidden="true">
      <div className="editor-skeleton__bubble" />
      <div className="editor-skeleton__bubble" data-short />
    </div>
  )
}

/** "5 of 8 slides made — Finish the rest?" under the filmstrip after a generation stopped early (05 §7). */
export function StoppedBanner({
  done,
  total,
  busy,
  onFinish
}: {
  done: number
  total: number
  busy: boolean
  onFinish(): void
}) {
  return (
    <Callout
      variant="action"
      className="editor-stopped"
      action={
        <Button size="sm" disabled={busy} onClick={onFinish}>
          Finish the rest
        </Button>
      }
    >
      {done} of {total} slides made — Finish the rest?
    </Callout>
  )
}
