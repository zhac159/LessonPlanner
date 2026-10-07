import { useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type SettingsApi, type UsageSummary } from '@shared/contracts/settings'

/**
 * This month's usage figure. Reads again whenever `refreshKey` changes (a test just ran, a key was
 * saved), so the number follows the teacher's actions. Null until known or when it cannot be read.
 */
export function useUsage(refreshKey: unknown): UsageSummary | null {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  useEffect(() => {
    let live = true
    settings
      .getUsage()
      .then((next) => live && setUsage(next))
      .catch(() => live && setUsage(null))
    return () => {
      live = false
    }
  }, [settings, refreshKey])
  return usage
}
