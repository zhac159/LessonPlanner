import { useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  SETTINGS,
  type AiStatus,
  type SettingsApi,
  type SettingsEvents
} from '@shared/contracts/settings'

/** A key is saved and the last test did not say it is invalid. */
export const isUsable = (status: AiStatus): boolean =>
  status.hasKey && status.lastTest?.result !== 'invalid-key'

/**
 * Whether Claude has a usable key: `null` until known (the screen then behaves as if it had one and
 * lets main say otherwise), then true or false, kept current by `settings:aiStatusChanged`.
 */
export function useAiReady(): boolean | null {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    settings
      .getAiStatus()
      .then((status) => live && setReady(isUsable(status)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [settings])

  useEvent<SettingsEvents, 'aiStatusChanged'>(SETTINGS, 'aiStatusChanged', (status) =>
    setReady(isUsable(status))
  )

  return ready
}
