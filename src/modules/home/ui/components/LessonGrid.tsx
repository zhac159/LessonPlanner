import type { KeyboardEvent } from 'react'
import { Button } from '@ui/atoms'
import { LessonCard } from '@ui/lesson'
import type { Point } from '@ui/overlays'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import { useProgressive } from '../hooks/useProgressive'
import { DamagedLessonCard } from './DamagedLessonCard'

export interface LessonGridProps {
  lessons: ReadonlyArray<LessonSummary>
  /** Changes when the filter, search or sort changes: the grid starts again at the first page. */
  resetKey: string
  now: Date
  /** The lesson whose menu is open, highlighted. */
  selectedId: string | null
  onOpen(lesson: LessonSummary): void
  onMenu(lesson: LessonSummary, anchor: Point): void
  onDelete(lesson: LessonSummary): void
  onRetry(): void
}

/** The responsive grid of LessonCards; the Delete key on a focused card asks to delete it. */
export function LessonGrid({
  lessons,
  resetKey,
  now,
  selectedId,
  onOpen,
  onMenu,
  onDelete,
  onRetry
}: LessonGridProps) {
  const { count, more, showMore, sentinel } = useProgressive(lessons.length, resetKey)

  const onKeyDown = (event: KeyboardEvent, lesson: LessonSummary): void => {
    if (event.key !== 'Delete' || lesson.damaged) return
    if (event.target !== event.currentTarget.querySelector('button')) return
    event.preventDefault()
    onDelete(lesson)
  }

  return (
    <>
      <ul className="home-grid" aria-label="Past lessons">
        {lessons.slice(0, count).map((lesson) => (
          <li
            key={lesson.id}
            className="home-grid__item"
            onKeyDown={(event) => onKeyDown(event, lesson)}
          >
            {lesson.damaged ? (
              <DamagedLessonCard
                lesson={lesson}
                onRetry={onRetry}
                onDelete={() => onDelete(lesson)}
              />
            ) : (
              <LessonCard
                title={lesson.title}
                yearTag={lesson.yearShort}
                slideCount={lesson.slideCount}
                updatedAt={lesson.updatedAt}
                now={now}
                thumbDataUrl={lesson.thumbDataUrl}
                status={lesson.status}
                selected={selectedId === lesson.id}
                onOpen={() => onOpen(lesson)}
                onMenu={(anchor) => onMenu(lesson, anchor)}
              />
            )}
          </li>
        ))}
      </ul>
      {more && (
        <div ref={sentinel} className="home-grid__more">
          <Button shape="pill" onClick={showMore}>
            Show more lessons
          </Button>
        </div>
      )}
    </>
  )
}
