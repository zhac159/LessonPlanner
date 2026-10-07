import { useCallback, useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  STYLE_LIBRARY,
  type StyleLibraryApi,
  type StyleLibraryEvents,
  type StyleSummary
} from '@shared/contracts/style-library'

export interface StylesState {
  /** `loading` until the first answer; a failed read counts as `ready` with no styles. */
  status: 'loading' | 'ready'
  styles: StyleSummary[]
}

/** The teacher's styles for the cards and the style chip, kept current by `style-library:changed`. */
export function useStyleSummaries(active: boolean): StylesState {
  const library = useClient<StyleLibraryApi>(STYLE_LIBRARY)
  const [state, setState] = useState<StylesState>({ status: 'loading', styles: [] })

  const reload = useCallback(async () => {
    try {
      setState({ status: 'ready', styles: await library.list() })
    } catch {
      setState((current) => ({ ...current, status: 'ready' }))
    }
  }, [library])

  useEffect(() => {
    if (active) void reload()
  }, [active, reload])

  useEvent<StyleLibraryEvents, 'changed'>(STYLE_LIBRARY, 'changed', (styles) =>
    setState({ status: 'ready', styles })
  )

  return state
}
