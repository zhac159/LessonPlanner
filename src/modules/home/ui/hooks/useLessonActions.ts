import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useClient, useShell } from '@renderer/sdk'
import { useToast, type Point } from '@ui/overlays'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type LessonSummary
} from '@shared/contracts/deck-builder'

const GENERIC_ERROR = 'Something went wrong. Try again.'

export interface LessonActions {
  /** The lesson whose ⋯ menu is open, and where. */
  menu: { lesson: LessonSummary; anchor: Point } | null
  /** An export found empty picture spots and is waiting for her answer. */
  spots: { lesson: LessonSummary; count: number } | null
  renaming: LessonSummary | null
  deleting: LessonSummary | null
  /** A rename or delete is running. */
  busy: boolean
  /** Why the rename could not be saved (shown in the dialog). */
  renameError: string | null
  openMenu(lesson: LessonSummary, anchor: Point): void
  closeMenu(): void
  open(lesson: LessonSummary): void
  duplicate(lesson: LessonSummary): Promise<void>
  exportPptx(lesson: LessonSummary): Promise<void>
  /** "Export anyway": exports again, leaving the empty spots out. */
  exportAnyway(): Promise<void>
  /** "Open lesson": closes the question and opens the lesson to fill the spots. */
  openSpotsLesson(): void
  cancelSpots(): void
  startRename(lesson: LessonSummary): void
  cancelRename(): void
  saveRename(title: string): Promise<void>
  askDelete(lesson: LessonSummary): void
  cancelDelete(): void
  confirmDelete(): Promise<void>
}

/** Replaces `next` in the list by id (a rename) or puts it first (a new copy). */
function upsert(list: LessonSummary[], next: LessonSummary): LessonSummary[] {
  return list.some((lesson) => lesson.id === next.id)
    ? list.map((lesson) => (lesson.id === next.id ? next : lesson))
    : [next, ...list]
}

/**
 * What the card menu does (03 §8): open, duplicate, rename, export and delete with Undo. Local list
 * edits are optimistic; main's `lessonsChanged` event is the final word.
 */
export function useLessonActions(
  setLessons: Dispatch<SetStateAction<LessonSummary[]>>,
  reload: () => Promise<void>
): LessonActions {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const { navigate } = useShell()
  const toast = useToast()
  const [menu, setMenu] = useState<LessonActions['menu']>(null)
  const [spots, setSpots] = useState<LessonActions['spots']>(null)
  const [renaming, setRenaming] = useState<LessonSummary | null>(null)
  const [deleting, setDeleting] = useState<LessonSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const fail = useCallback(
    (message?: string): void => {
      toast.show({ message: message || GENERIC_ERROR, tone: 'error' })
    },
    [toast]
  )

  const open = useCallback(
    (lesson: LessonSummary) => navigate(DECK_BUILDER, { kind: 'open-lesson', lessonId: lesson.id }),
    [navigate]
  )

  const duplicate = useCallback(
    async (lesson: LessonSummary) => {
      try {
        const result = await deckBuilder.duplicateLesson({ lessonId: lesson.id })
        if (!result.ok) return fail(result.message)
        setLessons((list) => upsert(list, result.lesson))
        toast.show({ message: `Duplicated “${lesson.title}”` })
      } catch {
        fail()
      }
    },
    [deckBuilder, setLessons, toast, fail]
  )

  const runExport = useCallback(
    async (lesson: LessonSummary, ignoreSpots: boolean) => {
      setBusy(true)
      try {
        const result = await deckBuilder.exportPptx({
          lessonId: lesson.id,
          ...(ignoreSpots ? { ignoreSpots } : {})
        })
        if (result.status === 'cancelled') return setSpots(null)
        if (result.status === 'spots') return setSpots({ lesson, count: result.count })
        setSpots(null)
        if (result.status === 'error') return fail(result.message)
        toast.show({
          message: `Saved ${result.fileName}`,
          action: {
            label: 'Open in PowerPoint',
            onAction: () => void deckBuilder.openExport({ path: result.path }).catch(() => {})
          }
        })
      } catch {
        setSpots(null)
        fail()
      } finally {
        setBusy(false)
      }
    },
    [deckBuilder, toast, fail]
  )

  const exportPptx = useCallback((lesson: LessonSummary) => runExport(lesson, false), [runExport])
  const exportAnyway = useCallback(async () => {
    if (spots) await runExport(spots.lesson, true)
  }, [spots, runExport])

  const saveRename = useCallback(
    async (title: string) => {
      if (!renaming) return
      setBusy(true)
      setRenameError(null)
      try {
        const result = await deckBuilder.renameLesson({
          lessonId: renaming.id,
          title: title.trim()
        })
        if (!result.ok) return setRenameError(result.message || GENERIC_ERROR)
        setLessons((list) => upsert(list, result.lesson))
        setRenaming(null)
      } catch {
        setRenameError(GENERIC_ERROR)
      } finally {
        setBusy(false)
      }
    },
    [renaming, deckBuilder, setLessons]
  )

  const confirmDelete = useCallback(async () => {
    const lesson = deleting
    if (!lesson) return
    setBusy(true)
    try {
      const result = await deckBuilder.deleteLesson({ lessonId: lesson.id })
      if (!result.ok) return fail(result.message)
      setLessons((list) => list.filter((item) => item.id !== lesson.id))
      toast.show({
        message: 'Lesson deleted',
        action: {
          label: 'Undo',
          onAction: () => {
            deckBuilder
              .restoreLesson({ lessonId: lesson.id })
              .then((undone) => (undone.ok ? reload() : fail(undone.message)))
              .catch(() => fail())
          }
        }
      })
    } catch {
      fail()
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }, [deleting, deckBuilder, setLessons, toast, reload, fail])

  return {
    menu,
    spots,
    renaming,
    deleting,
    busy,
    renameError,
    openMenu: (lesson, anchor) => setMenu({ lesson, anchor }),
    closeMenu: () => setMenu(null),
    open,
    duplicate,
    exportPptx,
    exportAnyway,
    openSpotsLesson: () => {
      if (!spots) return
      const { lesson } = spots
      setSpots(null)
      open(lesson)
    },
    cancelSpots: () => setSpots(null),
    startRename: (lesson) => {
      setRenameError(null)
      setRenaming(lesson)
    },
    cancelRename: () => setRenaming(null),
    saveRename,
    askDelete: setDeleting,
    cancelDelete: () => setDeleting(null),
    confirmDelete
  }
}
