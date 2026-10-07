import { PageHeader } from '@ui/chrome'
import { EditorWorkspace } from './EditorWorkspace'
import { useLesson } from './hooks/useLesson'
import { ChatSkeleton, EditorSkeleton, LessonLoadError } from './parts/LessonStates'
import './EditorScreen.css'

export interface EditorScreenProps {
  lessonId: string
  /** Changes when the shell asks to open this lesson again: the lesson is re-read. */
  reloadToken: number
  /** Text for the chat box from a deep link; `key` changes with every new request. */
  composer?: { text: string; key: number }
  /** The deck-builder is the visible module. */
  active: boolean
  /** "My lessons", "Back to Home". */
  onBack(): void
  /** The "Connect Claude" prompts in the chat. */
  onConnectClaude(): void
}

/**
 * The lesson editor (design/screens/06-editor.md). It opens the lesson, then hands the loaded lesson to
 * `EditorWorkspace`; while that happens, or when it fails, the header stays and the body shows a skeleton or the
 * "couldn’t be opened" card.
 */
export function EditorScreen({
  lessonId,
  reloadToken,
  composer,
  active,
  onBack,
  onConnectClaude
}: EditorScreenProps) {
  const lesson = useLesson(lessonId, reloadToken)
  const { load } = lesson

  if (load.status === 'ready') {
    return (
      <EditorWorkspace
        lessonId={lessonId}
        view={load.view}
        lesson={lesson}
        composer={composer}
        active={active}
        onBack={onBack}
        onConnectClaude={onConnectClaude}
      />
    )
  }

  return (
    <div className="editor">
      <PageHeader variant="editor" back={{ label: 'My lessons', onClick: onBack }} />
      {load.status === 'error' ? (
        <LessonLoadError onBack={onBack} />
      ) : (
        <div className="editor__body">
          <div className="editor__main">
            <div className="editor__column">
              <EditorSkeleton />
            </div>
          </div>
          <div className="editor__chat">
            <ChatSkeleton />
          </div>
        </div>
      )}
    </div>
  )
}
