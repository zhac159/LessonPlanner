import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  SETTINGS,
  type AiStatus,
  type SettingsApi,
  type SettingsEvents
} from '@shared/contracts/settings'

export interface AiStatusState {
  /** Null until the first answer arrives (normally within a few milliseconds). */
  status: AiStatus | null
  /** Optimistic local update; the next `aiStatusChanged` event or `refresh` replaces it. */
  setStatus: Dispatch<SetStateAction<AiStatus | null>>
  /** Reads the status again and returns it (null when the call fails). */
  refresh(): Promise<AiStatus | null>
}

/** The Claude connection state, kept current by the `aiStatusChanged` event (02 §6). */
export function useAiStatus(): AiStatusState {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [status, setStatus] = useState<AiStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await settings.getAiStatus()
      setStatus(next)
      return next
    } catch {
      return null
    }
  }, [settings])

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEvent<SettingsEvents>(SETTINGS, 'aiStatusChanged', setStatus)

  return { status, setStatus, refresh }
}
