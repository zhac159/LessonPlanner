import type { ContractClient } from '@shared/contract'
import type { SettingsApi } from '@shared/contracts/settings'
import type { ShellUser } from './types'

export interface OnboardingState {
  /** True while the first-run wizard still has to be shown. */
  firstRun: boolean
  /** The local user; null until onboarding is finished (or when settings are unavailable). */
  user: ShellUser | null
}

const SETTLED: OnboardingState = { firstRun: false, user: null }

/**
 * Reads the profile from the `settings` module. Tolerant by design: if the module or channel is
 * missing, or the call fails for any reason other than "no profile yet", behave as if onboarding
 * were done (no user) so the app is never trapped behind a broken settings module.
 */
export async function readOnboarding(
  settings: Pick<ContractClient<SettingsApi>, 'getProfile'>
): Promise<OnboardingState> {
  try {
    const result = await settings.getProfile()
    if (!result.ok) return result.code === 'not-found' ? { firstRun: true, user: null } : SETTLED
    const { profile } = result
    if (profile.onboarding.step !== 'done') return { firstRun: true, user: null }
    return {
      firstRun: false,
      user: { name: profile.name ?? '', claudeConnected: profile.claudeConnected }
    }
  } catch {
    return SETTLED
  }
}
