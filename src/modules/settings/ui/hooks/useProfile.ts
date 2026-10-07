import { useCallback, useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { SETTINGS, type SettingsApi, type UserProfile } from '@shared/contracts/settings'
import { fail, type Result } from '@shared/result'

export const SAVE_FAILED = 'Couldn’t save that. Try again.'

export interface ProfileState {
  /** False until the first answer (or failure) has arrived. */
  loaded: boolean
  /** Null on a fresh install or when the profile could not be read. */
  profile: UserProfile | null
  /** Saves a name/subject change; a failure carries the message to show. */
  save(patch: { name?: string; subject?: string | null }): Promise<Result<{ profile: UserProfile }>>
}

/** The teacher's profile (name, subject, onboarding step) from the settings module. */
export function useProfile(): ProfileState {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [state, setState] = useState<{ loaded: boolean; profile: UserProfile | null }>({
    loaded: false,
    profile: null
  })

  useEffect(() => {
    let live = true
    settings
      .getProfile()
      .then(
        (result) => live && setState({ loaded: true, profile: result.ok ? result.profile : null })
      )
      .catch(() => live && setState({ loaded: true, profile: null }))
    return () => {
      live = false
    }
  }, [settings])

  const save = useCallback<ProfileState['save']>(
    async (patch) => {
      try {
        const result = await settings.setProfile(patch)
        if (result.ok) setState({ loaded: true, profile: result.profile })
        return result
      } catch {
        return fail('io', SAVE_FAILED)
      }
    },
    [settings]
  )

  return { loaded: state.loaded, profile: state.profile, save }
}
