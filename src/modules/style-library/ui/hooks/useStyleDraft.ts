import { useCallback, useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type {
  StyleDraftView,
  StyleLibraryApi,
  StyleLibraryEvents
} from '@shared/contracts/style-library'
import { MODULE_ID } from '../../shared'
import { applyProgress, needsReload } from '../model/applyProgress'

export interface StyleDraft {
  /** The style with its queue and learned profile; null while loading, with no style yet, or on error. */
  view: StyleDraftView | null
  loading: boolean
  /** Why the style could not be loaded (the Failure message). */
  error: string | null
  /** Asks main for the whole view again and returns it. */
  reload(): Promise<StyleDraftView | null>
  /** Replaces the view with one main already returned (e.g. from `update`). */
  adopt(view: StyleDraftView): void
}

/**
 * One style for the Create a style screen: loads it, then keeps it live from `progress` events
 * (main pushes every change; nothing polls). With `styleId` null there is no style yet (an empty draft).
 */
export function useStyleDraft(styleId: string | null): StyleDraft {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  const [view, setView] = useState<StyleDraftView | null>(null)
  const [loading, setLoading] = useState(styleId !== null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<StyleDraftView | null> => {
    if (styleId === null) return null
    try {
      const result = await styles.get({ styleId })
      if (!result.ok) {
        setError(result.message)
        return null
      }
      setError(null)
      setView(result.style)
      return result.style
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t load this style.')
      return null
    } finally {
      setLoading(false)
    }
  }, [styles, styleId])

  useEffect(() => {
    setView(null)
    setError(null)
    setLoading(styleId !== null)
    void load()
  }, [styleId, load])

  useEvent<StyleLibraryEvents, 'progress'>(MODULE_ID, 'progress', (event) => {
    if (event.styleId !== styleId) return
    setView((current) => (current ? applyProgress(current, event) : current))
  })

  const mismatch = view !== null && needsReload(view)
  useEffect(() => {
    if (mismatch) void load()
  }, [mismatch, load])

  return { view, loading, error, reload: load, adopt: setView }
}
