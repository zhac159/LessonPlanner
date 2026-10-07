import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useEvent, useShell } from '@renderer/sdk'
import type { AssetSummary, AssetUsage } from '@shared/contracts/assets'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type DeckBuilderEvents,
  type LessonSummary
} from '@shared/contracts/deck-builder'
import type { MenuItem } from '@ui/overlays'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { useAnchoredMenu, type AnchoredMenu } from './useAnchoredMenu'

export interface LessonLinks {
  menu: AnchoredMenu
  /** Why "Use in a lesson" is off, or undefined. */
  useDisabledReason: string | undefined
  /** "Use in a lesson": the menu "Which lesson?" with her five newest lessons and "Start a new lesson". */
  chooseLesson(asset: Pick<AssetSummary, 'name'>): void
  /** The "14 lessons" link: lessons and slide numbers; choosing one opens it in the editor. */
  showUsage(assetId: string): Promise<void>
}

const RECENT = 5

const slidesText = (numbers: readonly number[]): string =>
  numbers.length === 0
    ? ''
    : ` · ${numbers.length === 1 ? 'slide' : 'slides'} ${numbers.slice(0, 6).join(', ')}`

/** The two small menus of the detail pane. Lessons come from the editor's contract (the sanctioned cross-module read). */
export function useLessonLinks(active: boolean): LessonLinks {
  const decks = useClient<DeckBuilderApi>(DECK_BUILDER)
  const assets = useClient<AssetsFullApi>(MODULE_ID)
  const { navigate } = useShell()
  const menu = useAnchoredMenu()
  const [lessons, setLessons] = useState<LessonSummary[]>([])

  useEffect(() => {
    if (!active) return
    decks
      .listLessons()
      .then(setLessons)
      .catch(() => undefined)
  }, [decks, active])
  useEvent<DeckBuilderEvents, 'lessonsChanged'>(DECK_BUILDER, 'lessonsChanged', setLessons)

  const recent = useMemo(
    () =>
      lessons
        .filter((lesson) => !lesson.damaged)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, RECENT),
    [lessons]
  )

  const chooseLesson = useCallback(
    (asset: Pick<AssetSummary, 'name'>) => {
      if (recent.length === 0) return
      const composerText = `{{${asset.name}}} `
      const items: MenuItem[] = recent.map((lesson) => ({
        id: lesson.id,
        label: `${lesson.title} · ${lesson.slideCount} ${lesson.slideCount === 1 ? 'slide' : 'slides'}`,
        onSelect: () =>
          navigate(DECK_BUILDER, { kind: 'open-lesson', lessonId: lesson.id, composerText })
      }))
      items.push({
        id: 'new',
        label: 'Start a new lesson',
        onSelect: () => navigate(DECK_BUILDER, { kind: 'new-lesson', composerText })
      })
      menu.show('Which lesson?', items)
    },
    [menu, navigate, recent]
  )

  const showUsage = useCallback(
    async (assetId: string) => {
      const result = await assets.usage({ assetId }).catch(() => null)
      if (!result?.ok) return
      const usage: AssetUsage = result.usage
      menu.show(
        'Used in',
        usage.lessons.map((lesson) => ({
          id: lesson.lessonId,
          label: `${lesson.title}${slidesText(lesson.slideNumbers)}`,
          onSelect: () => navigate(DECK_BUILDER, { kind: 'open-lesson', lessonId: lesson.lessonId })
        }))
      )
    },
    [assets, menu, navigate]
  )

  return {
    menu,
    useDisabledReason: lessons.length === 0 ? 'Make a lesson first' : undefined,
    chooseLesson,
    showUsage
  }
}
