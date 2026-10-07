import { useCallback, useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'

/** The "New" pill shows until the "Add asset" tile has been used this many times (agents/ASSETS.md §3.3). */
export const NEW_PILL_USES = 3

/** How often "Add asset" was used (kept in the `settings` preferences), and a way to count one more use. */
export function useAssetsMenu() {
  const client = useClient<SettingsApi>(SETTINGS)
  const [uses, setUses] = useState(0)

  useEffect(() => {
    let current = true
    Promise.resolve(client.getPreferences())
      .then((prefs) => current && setUses(prefs.assetsMenuUses ?? 0))
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [client])

  const recordUse = useCallback((): void => {
    setUses((was) => {
      const next = was + 1
      void Promise.resolve(client.setPreferences({ assetsMenuUses: next })).catch(() => undefined)
      return next
    })
  }, [client])

  return { showNew: uses < NEW_PILL_USES, recordUse }
}
