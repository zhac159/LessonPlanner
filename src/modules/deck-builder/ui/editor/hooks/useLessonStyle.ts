import { useCallback, useEffect, useState } from 'react'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import {
  STYLE_LIBRARY,
  type StyleLibraryApi,
  type StyleLibraryEvents,
  type StyleSummary
} from '@shared/contracts/style-library'
import { useClient, useEvent } from '@renderer/sdk'
import { useToast } from '@ui/overlays'

export interface LessonStyle {
  /** Styles the lesson can be redrawn in, default first (drafts and failed ones are left out). */
  styles: StyleSummary[]
  /** The style the lesson uses now (null: the plain style, or a style that no longer exists). */
  current: StyleSummary | null
  /** A different style was picked in the chip and awaits the "Restyle this lesson?" answer. */
  pending: StyleSummary | null
  ask(styleId: string): void
  cancel(): void
  /** "Restyle": sends a chat turn that redraws every slide (06 §8.10). */
  confirm(): Promise<void>
  restyling: boolean
}

const usable = (styles: StyleSummary[]): StyleSummary[] =>
  styles
    .filter((style) => style.status !== 'draft' && style.status !== 'failed')
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

/** The style chip of the editor header and the restyle question behind it (06 §8.10). */
export function useLessonStyle(
  lessonId: string,
  styleId: string | null,
  currentSlideId: string | null
): LessonStyle {
  const library = useClient<StyleLibraryApi>(STYLE_LIBRARY)
  const chat = useClient<DeckBuilderApi>(DECK_BUILDER)
  const toast = useToast()
  const [all, setAll] = useState<StyleSummary[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [restyling, setRestyling] = useState(false)

  useEffect(() => {
    let live = true
    library
      .list()
      .then((list) => live && setAll(list))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [library])
  useEvent<StyleLibraryEvents, 'changed'>(STYLE_LIBRARY, 'changed', setAll)

  const styles = usable(all)
  const current = all.find((style) => style.id === styleId) ?? null
  const pending = styles.find((style) => style.id === pendingId) ?? null

  const ask = useCallback(
    (id: string) => {
      if (id !== styleId) setPendingId(id)
    },
    [styleId]
  )
  const cancel = useCallback(() => setPendingId(null), [])

  const confirm = useCallback(async () => {
    if (!pending || !currentSlideId) return
    setRestyling(true)
    try {
      const result = await chat['chat:send']({
        lessonId,
        text: `Restyle this lesson in my “${pending.name}” style: redraw every slide with it.`,
        attachmentIds: [],
        regions: [],
        markup: [],
        selectedSlideId: currentSlideId,
        assetRefs: []
      })
      if (!result.ok) toast.show({ message: result.message, tone: 'error' })
    } catch {
      toast.show({ message: 'Couldn’t restyle the lesson. Nothing was changed.', tone: 'error' })
    } finally {
      setRestyling(false)
      setPendingId(null)
    }
  }, [chat, lessonId, pending, currentSlideId, toast])

  return { styles, current, pending, ask, cancel, confirm, restyling }
}
