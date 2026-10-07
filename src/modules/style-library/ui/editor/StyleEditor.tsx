import { useEffect, type DragEvent } from 'react'
import { useShell } from '@renderer/sdk'
import { Button, Callout, splitByExtension } from '@ui/atoms'
import { allFailed } from '../model/progressText'
import { useMediaQuery, STACK_QUERY } from '../hooks/useNarrow'
import { useStyleEditor } from '../hooks/useStyleEditor'
import { STYLE_FILE_EXTENSIONS } from '../../shared'
import { EditorHeader } from './EditorHeader'
import { FilesCard } from './FilesCard'
import { LearnedPanel } from './LearnedPanel'
import './editor.css'

export interface StyleEditorProps {
  /** The style to show; null is an empty draft (created by its first files). */
  styleId: string | null
  /** "new" = Create a style, "edit" = Edit style. */
  mode: 'new' | 'edit'
  subject?: string | null
  /** She has no other style: "Make this my default style" starts ticked. */
  firstStyle: boolean
  /** The screen is the visible module (Ctrl+O only works then). */
  active: boolean
  /** Saved: the module returns to its list for next time. */
  onSaved: () => void
}

/** The Create a style / Edit style screen (design/screens/04-create-style.md). */
export function StyleEditor({
  styleId,
  mode,
  subject,
  firstStyle,
  active,
  onSaved
}: StyleEditorProps) {
  const { navigate } = useShell()
  const editor = useStyleEditor({
    styleId,
    mode,
    subject,
    firstStyle,
    onSaved: () => {
      navigate('home')
      onSaved()
    }
  })
  const { draft, identity, files, correction } = editor
  const stacked = useMediaQuery(STACK_QUERY)
  const { view } = draft

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void files.browse()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, files])

  if (draft.error && !view) {
    return (
      <div className="cs-screen cs-screen--message">
        <Callout
          variant="error"
          action={<Button onClick={() => navigate('home')}>Back to Home</Button>}
        >
          {draft.error}
        </Callout>
      </div>
    )
  }

  if (draft.loading && !view) {
    return (
      <div className="cs-screen" aria-busy="true">
        <p className="sr-only" role="status">
          Loading your style…
        </p>
      </div>
    )
  }

  const dropAnywhere = (event: DragEvent): void => {
    if (event.defaultPrevented) return // the Dropzone handled it
    event.preventDefault()
    const { accepted, rejected } = splitByExtension(
      Array.from(event.dataTransfer.files),
      STYLE_FILE_EXTENSIONS
    )
    if (accepted.length > 0) void files.addDropped(accepted)
    files.skip(rejected.length)
  }

  const progress = view?.progress ?? {
    learned: 0,
    failed: 0,
    total: 0,
    stage: 'idle' as const,
    etaSeconds: null
  }
  const fileList = view?.files ?? []

  return (
    <div
      className="cs-screen"
      aria-busy={draft.loading || undefined}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropAnywhere}
    >
      <EditorHeader
        mode={mode}
        progress={progress}
        canSave={editor.canSave}
        saving={editor.saving}
        onBack={() => navigate('home')}
        onSave={() => void editor.save()}
      />
      <div className="cs-main">
        <FilesCard
          files={fileList}
          progress={progress}
          adding={files.adding}
          compact={stacked}
          onFiles={(dropped) => void files.addDropped(dropped)}
          onRejected={(rejected) => files.skip(rejected.length)}
          onBrowse={() => void files.browse()}
          onRemove={(file) => void files.remove(file)}
          onRetry={(file) => void files.retry(file)}
          onResume={() => void files.resume()}
          onConnect={() => navigate('settings', { kind: 'ai' })}
        />
        <LearnedPanel
          identity={identity}
          profile={view?.profile ?? null}
          empty={fileList.length === 0 || allFailed(progress)}
          correction={correction}
          corrections={view?.corrections ?? []}
          progress={progress}
          onReviewAssets={(batchId) =>
            navigate('assets', batchId ? { kind: 'review', batchId } : { kind: 'review' })
          }
          onOpenAssets={() => navigate('assets', { kind: 'library' })}
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {editor.announcement}
      </p>
    </div>
  )
}
