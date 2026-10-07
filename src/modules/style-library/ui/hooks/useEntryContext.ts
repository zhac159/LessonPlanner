import { useCallback } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'
import type { StyleLibraryApi } from '@shared/contracts/style-library'
import { MODULE_ID } from '../../shared'

export interface EntryContext {
  /** Her subject from Welcome: the starting name of a new style. */
  subject: string | null
  /** How many styles she has: none means the Styles item opens an empty draft and the first style is the default. */
  styleCount: number
}

/**
 * Reads what the module needs to decide how to open: how many styles exist right now and her subject.
 * Always fresh (a stale count would mis-tick "Make this my default style"). A failed read counts as
 * "no styles, no subject" so the screen still opens.
 */
export function useEntryContext(): () => Promise<EntryContext> {
  const styles = useClient<StyleLibraryApi>(MODULE_ID)
  const settings = useClient<SettingsApi>(SETTINGS)
  return useCallback(async () => {
    const [list, profile] = await Promise.all([
      styles.list().catch(() => []),
      settings.getProfile().catch(() => null)
    ])
    return {
      styleCount: list.length,
      subject: profile && profile.ok ? profile.profile.subject : null
    }
  }, [styles, settings])
}
