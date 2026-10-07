import { useMemo, useState } from 'react'
import { Button, Callout } from '@ui/atoms'
import { useShell, type ModuleViewProps } from '@renderer/sdk'
import { HomeHeader } from './components/HomeHeader'
import { LessonOverlays } from './components/LessonOverlays'
import { NewLessonCard } from './components/NewLessonCard'
import { PastLessons } from './components/PastLessons'
import { StylesCard } from './components/StylesCard'
import { useClaudeStatus } from './hooks/useClaudeStatus'
import { useHomePreferences } from './hooks/useHomePreferences'
import { useHomeSearch } from './hooks/useHomeSearch'
import { useLessonActions } from './hooks/useLessonActions'
import { useLessons } from './hooks/useLessons'
import { useNewLesson } from './hooks/useNewLesson'
import { useNow } from './hooks/useNow'
import { useStyleActions } from './hooks/useStyleActions'
import { useStyleSummaries } from './hooks/useStyleSummaries'
import { greetingFor } from './model/greeting'
import {
  ALL_YEARS,
  effectiveYear,
  emptyKind,
  filterLessons,
  sortLessons,
  yearGroups
} from './model/lessons'
import { filterStyles, orderStyles } from './model/styles'
import './home.css'

/**
 * Home (design/screens/03-home.md): greeting and search, the "Make a new lesson" card, "Your styles"
 * and the past lessons. This view only wires hooks to presentational components.
 */
export function HomeView({ active }: ModuleViewProps) {
  const { user, issues, navigate } = useShell()
  const now = useNow(active)
  const search = useHomeSearch(active)
  const prefs = useHomePreferences()
  const connected = useClaudeStatus(active)
  const lessons = useLessons(active)
  const styleList = useStyleSummaries(active)
  const styleActions = useStyleActions()
  const lessonActions = useLessonActions(lessons.setLessons, lessons.reload)
  const [yearChoice, setYearChoice] = useState(ALL_YEARS)

  const orderedStyles = useMemo(() => orderStyles(styleList.styles), [styleList.styles])
  const form = useNewLesson({
    styles: orderedStyles,
    connected,
    lastLengthMin: prefs.lastLengthMin,
    onLengthChosen: prefs.rememberLength
  })

  const years = useMemo(() => yearGroups(lessons.lessons), [lessons.lessons])
  const year = effectiveYear(yearChoice, years)
  const shownLessons = useMemo(
    () => sortLessons(filterLessons(lessons.lessons, { query: search.query, year }), prefs.sort),
    [lessons.lessons, search.query, year, prefs.sort]
  )
  const matchingStyles = useMemo(
    () => filterStyles(orderedStyles, search.query),
    [orderedStyles, search.query]
  )
  const empty = emptyKind({
    total: lessons.lessons.length,
    shown: shownLessons.length,
    query: search.query,
    year
  })
  const connectClaude = (): void => navigate('settings', { kind: 'ai' })
  const searching = search.query.trim() !== ''

  return (
    <div className="home" data-testid="home">
      <main className="home__main">
        <HomeHeader
          greeting={greetingFor(now, user?.name)}
          search={search}
          onNewLesson={() => navigate('deck-builder', { kind: 'new-lesson' })}
        />
        {connected === false && (
          <Callout
            variant="action"
            action={<Button onClick={connectClaude}>Connect Claude</Button>}
          >
            Claude isn’t connected yet, so I can’t make slides.
          </Callout>
        )}
        <div className="home__cards">
          <NewLessonCard
            form={form}
            styles={orderedStyles}
            onCreateStyle={styleActions.createStyle}
            onConnectClaude={connectClaude}
          />
          <StylesCard
            loading={styleList.status === 'loading'}
            styles={orderedStyles}
            matching={matchingStyles}
            query={search.query}
            busy={styleActions.busy}
            onOpen={styleActions.openStyle}
            onManage={styleActions.manage}
            onBrowse={() => void styleActions.browse()}
            onFiles={(files) => void styleActions.drop(files)}
          />
        </div>
        <PastLessons
          status={lessons.status}
          lessons={shownLessons}
          empty={empty}
          years={years}
          year={year}
          sort={prefs.sort}
          now={now}
          selectedId={lessonActions.menu?.lesson.id ?? null}
          onYear={setYearChoice}
          onSort={prefs.setSort}
          onOpen={lessonActions.open}
          onMenu={lessonActions.openMenu}
          onDelete={lessonActions.askDelete}
          onRetry={() => void lessons.reload()}
          onClearSearch={search.clear}
        />
        {issues.length > 0 && (
          <Callout variant="warning" title="Modules that failed to load">
            <ul className="home__issues">
              {issues.map((issue) => (
                <li key={`${issue.moduleId}:${issue.path}`}>
                  {issue.moduleId}: {issue.message}
                </li>
              ))}
            </ul>
          </Callout>
        )}
        <p className="home__sr-only" role="status" aria-live="polite">
          {searching ? `${shownLessons.length} lessons, ${matchingStyles.length} styles` : ''}
        </p>
      </main>
      <LessonOverlays actions={lessonActions} />
    </div>
  )
}
