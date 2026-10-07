import { useEffect, useState, type KeyboardEvent } from 'react'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import { Button, Callout } from '@ui/atoms'
import { TextField } from '@ui/forms'
import { LessonCard } from '@ui/lesson'
import { Dialog } from '@ui/overlays'

export interface PastLessonDialogProps {
  open: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  lessons: ReadonlyArray<LessonSummary>
  /** The copy is being made: the dialog stays open and locked. */
  copying?: boolean
  /** Why the list or the copy failed. */
  error?: string | null
  onClose(): void
  /** "Use this lesson", or a double-click or Enter on a card. */
  onUse(lessonId: string): void
}

/** Lessons whose title contains the search text, case-insensitively. */
export const matchLessons = (
  lessons: ReadonlyArray<LessonSummary>,
  query: string
): LessonSummary[] => {
  const needle = query.trim().toLowerCase()
  return needle ? lessons.filter((l) => l.title.toLowerCase().includes(needle)) : [...lessons]
}

/** "Start from a past lesson" (05 §8.9): a search field and a grid of lesson cards, no menus. */
export function PastLessonDialog({
  open,
  status,
  lessons,
  copying = false,
  error,
  onClose,
  onUse
}: PastLessonDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedId(null)
    }
  }, [open])

  const shown = matchLessons(lessons, query)
  const selected = lessons.find((l) => l.id === selectedId)
  const use = (lessonId: string): void => {
    if (!copying) onUse(lessonId)
  }
  const onCardKeyDown = (event: KeyboardEvent, lessonId: string): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    use(lessonId)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!copying}
      title="Start from a past lesson"
      description="Pick a lesson and I’ll open a copy for you to build on."
      footer={
        <>
          <Button onClick={onClose} disabled={copying}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selectedId}
            loading={copying}
            loadingLabel="Copying…"
            onClick={() => selectedId && use(selectedId)}
          >
            Use this lesson
          </Button>
        </>
      }
    >
      <div className="nl-past">
        <TextField
          variant="search"
          label="Search lessons"
          placeholder="Search lessons"
          value={query}
          data-autofocus
          onChange={(event) => setQuery(event.target.value)}
        />
        {error && <Callout variant="error">{error}</Callout>}
        {status === 'loading' && <p className="nl-past__note">Loading your lessons…</p>}
        {status === 'error' && !error && (
          <Callout variant="error">I couldn’t load your lessons.</Callout>
        )}
        {status === 'ready' && lessons.length === 0 && (
          <p className="nl-past__note">You haven’t made any lessons yet.</p>
        )}
        {status === 'ready' && lessons.length > 0 && shown.length === 0 && (
          <p className="nl-past__note">No lessons match “{query.trim()}”.</p>
        )}
        <p className="sr-only" role="status">
          {selected ? `${selected.title} selected` : ''}
        </p>
        {shown.length > 0 && (
          <ul className="nl-past__grid" aria-label="Your lessons">
            {shown.map((lesson) => (
              <li
                key={lesson.id}
                onDoubleClick={() => use(lesson.id)}
                onKeyDown={(event) => onCardKeyDown(event, lesson.id)}
              >
                <LessonCard
                  title={lesson.title}
                  yearTag={lesson.yearShort}
                  slideCount={lesson.slideCount}
                  updatedAt={lesson.updatedAt}
                  thumbDataUrl={lesson.thumbDataUrl}
                  status={lesson.status}
                  selected={lesson.id === selectedId}
                  onOpen={() => setSelectedId(lesson.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
