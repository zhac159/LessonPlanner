import { useEffect, useRef, useState } from 'react'
import {
  DECK_BUILDER,
  type CreateLessonRequest,
  type LessonsApi
} from '@shared/contracts/deck-builder'
import { useClient } from '@renderer/sdk'
import { PageHeader } from '@ui/chrome'
import { Button, EmptyState } from '@ui/atoms'
import { FileWarning } from 'lucide-react'
import { EditorSkeleton, ChatSkeleton } from './LessonStates'
import '../EditorScreen.css'

export interface CreateLessonRouteProps {
  request: CreateLessonRequest
  /** The lesson exists and generation started: open the editor on it. */
  onCreated(lessonId: string): void
  onBack(): void
}

/**
 * Home's "Create lesson" (03 §8): makes the lesson from the quick card and opens it already generating (05 §7).
 * Shows the editor's skeleton for the moment this takes, or says what went wrong with a way back.
 */
export function CreateLessonRoute({ request, onCreated, onBack }: CreateLessonRouteProps) {
  const client = useClient<LessonsApi>(DECK_BUILDER)
  const [failure, setFailure] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    client
      .createLesson(request)
      .then((result) => (result.ok ? onCreated(result.lessonId) : setFailure(result.message)))
      .catch(() => setFailure('Something went wrong while making the lesson.'))
  }, [client, request, onCreated])

  return (
    <div className="editor">
      <PageHeader variant="editor" back={{ label: 'My lessons', onClick: onBack }} />
      {failure ? (
        <div className="lesson-error" role="alert">
          <EmptyState
            variant="list"
            icon={<FileWarning strokeWidth={2} />}
            title="We couldn’t start your lesson."
            actions={
              <Button variant="primary" onClick={onBack}>
                Back to Home
              </Button>
            }
          >
            {failure}
          </EmptyState>
        </div>
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
