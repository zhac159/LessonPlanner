import { Monitor } from 'lucide-react'
import { Button, Callout, EmptyState } from '@ui/atoms'
import { Select } from '@ui/forms'
import type { Point } from '@ui/overlays'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { HomeSort } from '@shared/contracts/settings'
import type { LessonsEmpty } from '../model/lessons'
import { LessonGrid } from './LessonGrid'
import { LessonSkeletons } from './LessonSkeletons'
import { YearFilter } from './YearFilter'
import './PastLessons.css'

const SORT_OPTIONS = [
  { value: 'edited', label: 'Last edited' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'year', label: 'Year group' }
]

export interface PastLessonsProps {
  status: 'loading' | 'ready' | 'error'
  /** Lessons to show: filtered and sorted already. */
  lessons: ReadonlyArray<LessonSummary>
  empty: LessonsEmpty
  years: ReadonlyArray<string>
  year: string
  sort: HomeSort
  now: Date
  selectedId: string | null
  onYear(year: string): void
  onSort(sort: HomeSort): void
  onOpen(lesson: LessonSummary): void
  onMenu(lesson: LessonSummary, anchor: Point): void
  onDelete(lesson: LessonSummary): void
  onRetry(): void
  onClearSearch(): void
}

function EmptyLessons({ empty, onClearSearch }: Pick<PastLessonsProps, 'empty' | 'onClearSearch'>) {
  const icon = <Monitor strokeWidth={2.2} />
  if (empty.kind === 'no-lessons') {
    return (
      <EmptyState icon={icon} title="No lessons yet" variant="list">
        Paste your objectives above and press Create lesson. Your lessons will appear here.
      </EmptyState>
    )
  }
  if (empty.kind === 'no-match') {
    return (
      <EmptyState
        icon={icon}
        title={`No lessons match “${empty.query}”`}
        variant="list"
        actions={<Button onClick={onClearSearch}>Clear search</Button>}
      />
    )
  }
  if (empty.kind === 'no-year') {
    return <EmptyState icon={icon} title={`No ${empty.year} lessons yet.`} variant="list" />
  }
  return null
}

/** The "Past lessons" section: filter chips, sort, the grid and every empty, loading and error state. */
export function PastLessons(props: PastLessonsProps) {
  const { status, lessons, empty, years, year, sort, now, selectedId } = props
  const showControls = status === 'ready' && empty.kind !== 'no-lessons'

  return (
    <section
      className="home-past"
      aria-labelledby="home-past-title"
      aria-busy={status === 'loading'}
    >
      <div className="home-past__head">
        <h2 id="home-past-title" className="home-past__title">
          Past lessons
        </h2>
        {showControls && <YearFilter years={years} value={year} onChange={props.onYear} />}
        <span className="home-past__spacer" />
        {showControls && (
          <Select
            label="Sort"
            labelPosition="inline"
            size="sm"
            className="home-past__sort"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(value) => props.onSort(value as HomeSort)}
          />
        )}
      </div>
      {status === 'loading' && <LessonSkeletons />}
      {status === 'error' && (
        <Callout variant="error" action={<Button onClick={props.onRetry}>Try again</Button>}>
          I couldn’t load your lessons.
        </Callout>
      )}
      {status === 'ready' && empty.kind !== 'none' && (
        <EmptyLessons empty={empty} onClearSearch={props.onClearSearch} />
      )}
      {status === 'ready' && lessons.length > 0 && (
        <LessonGrid
          lessons={lessons}
          resetKey={`${year}|${sort}|${lessons.length}`}
          now={now}
          selectedId={selectedId}
          onOpen={props.onOpen}
          onMenu={props.onMenu}
          onDelete={props.onDelete}
          onRetry={props.onRetry}
        />
      )}
    </section>
  )
}
