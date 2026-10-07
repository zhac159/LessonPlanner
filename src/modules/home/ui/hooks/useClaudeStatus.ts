import { useEffect, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  SETTINGS,
  type AiStatus,
  type SettingsApi,
  type SettingsEvents
} from '@shared/contracts/settings'

/** A key is saved and the last test did not say it is invalid (03 §5 user chip). */
export function isClaudeConnected(status: AiStatus): boolean {
  return status.hasKey && status.lastTest?.result !== 'invalid-key'
}

/**
 * Whether Claude is connected: `null` until known (nothing is shown meanwhile), then true or false,
 * kept current by `settings:aiStatusChanged`.
 */
export function useClaudeStatus(active: boolean): boolean | null {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let live = true
    settings
      .getAiStatus()
      .then((status) => live && setConnected(isClaudeConnected(status)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [settings, active])

  useEvent<SettingsEvents>(SETTINGS, 'aiStatusChanged', (status) =>
    setConnected(isClaudeConnected(status))
  )

  return connected
}
