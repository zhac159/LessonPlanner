import { useCallback, useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type HomeSort, type SettingsApi } from '@shared/contracts/settings'

export interface HomePreferences {
  /** False until the saved choices have arrived (the defaults apply meanwhile). */
  loaded: boolean
  sort: HomeSort
  lastLengthMin: number | null
  /** Changes and saves the sort order. */
  setSort(sort: HomeSort): void
  /** Saves the lesson length the teacher picked. */
  rememberLength(minutes: number): void
}

/** The remembered Home sort order and lesson length (`settings:getPreferences` / `setPreferences`). */
export function useHomePreferences(): HomePreferences {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [state, setState] = useState<{
    loaded: boolean
    sort: HomeSort
    lastLengthMin: number | null
  }>({ loaded: false, sort: 'edited', lastLengthMin: null })

  useEffect(() => {
    let live = true
    settings
      .getPreferences()
      .then(
        (prefs) =>
          live &&
          setState({ loaded: true, sort: prefs.homeSort, lastLengthMin: prefs.lastLengthMin })
      )
      .catch(() => live && setState((current) => ({ ...current, loaded: true })))
    return () => {
      live = false
    }
  }, [settings])

  const save = useCallback(
    (patch: { homeSort?: HomeSort; lastLengthMin?: number }) => {
      settings.setPreferences(patch).catch(() => {})
    },
    [settings]
  )

  const setSort = useCallback(
    (sort: HomeSort) => {
      setState((current) => ({ ...current, sort }))
      save({ homeSort: sort })
    },
    [save]
  )

  const rememberLength = useCallback(
    (minutes: number) => {
      setState((current) => ({ ...current, lastLengthMin: minutes }))
      save({ lastLengthMin: minutes })
    },
    [save]
  )

  return { ...state, setSort, rememberLength }
}
