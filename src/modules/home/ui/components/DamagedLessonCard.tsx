import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@ui/atoms'
import type { LessonSummary } from '@shared/contracts/deck-builder'

export interface DamagedLessonCardProps {
  lesson: LessonSummary
  /** Read the lesson list again (the file may have been fixed). */
  onRetry(): void
  /** Ask to delete the lesson (the usual confirmation follows). */
  onDelete(): void
}

/** Stands in for a lesson whose file cannot be read: says so and offers a way out, never crashes. */
export function DamagedLessonCard({ lesson, onRetry, onDelete }: DamagedLessonCardProps) {
  const id = useId()
  return (
    <article
      className="home-damaged"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
    >
      <TriangleAlert size={22} strokeWidth={2.2} aria-hidden="true" />
      <h3 id={`${id}-title`} className="home-damaged__title" title={lesson.title}>
        {lesson.title || 'Untitled lesson'}
      </h3>
      <p id={`${id}-text`} className="home-damaged__text">
        I couldn’t read this lesson’s file.
      </p>
      <div className="home-damaged__actions">
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
        <Button size="sm" onClick={onDelete}>
          Delete…
        </Button>
      </div>
    </article>
  )
}
