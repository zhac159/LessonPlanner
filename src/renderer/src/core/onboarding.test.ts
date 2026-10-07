import { describe, expect, it } from 'vitest'
import type { UserProfile } from '@shared/contracts/settings'
import { fail, ok } from '@shared/result'
import { readOnboarding } from './onboarding'

const profile = (patch: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Ms Rivera',
  subject: null,
  onboarding: { step: 'done', completedAt: '2026-10-01T09:00:00Z', skippedAi: false },
  claudeConnected: true,
  ...patch
})

const settingsReturning = (result: unknown) => ({ getProfile: async () => result as never })

describe('readOnboarding', () => {
  it('returns the user once onboarding is done', async () => {
    const state = await readOnboarding(settingsReturning(ok({ profile: profile() })))
    expect(state).toEqual({ firstRun: false, user: { name: 'Ms Rivera', claudeConnected: true } })
  })

  it('reports a missing key through claudeConnected', async () => {
    const state = await readOnboarding(
      settingsReturning(ok({ profile: profile({ claudeConnected: false }) }))
    )
    expect(state.user?.claudeConnected).toBe(false)
  })

  it('falls back to an empty name when the finished profile has none', async () => {
    const state = await readOnboarding(settingsReturning(ok({ profile: profile({ name: null }) })))
    expect(state.user?.name).toBe('')
  })

  it.each(['about', 'connect'] as const)('is first run while the step is "%s"', async (step) => {
    const unfinished = profile({ onboarding: { step, completedAt: null, skippedAi: false } })
    expect(await readOnboarding(settingsReturning(ok({ profile: unfinished })))).toEqual({
      firstRun: true,
      user: null
    })
  })

  it('treats "no profile yet" as first run', async () => {
    const state = await readOnboarding(settingsReturning(fail('not-found', 'No profile')))
    expect(state).toEqual({ firstRun: true, user: null })
  })

  it('does not trap the user behind other failures', async () => {
    const state = await readOnboarding(settingsReturning(fail('io', 'Disk error')))
    expect(state).toEqual({ firstRun: false, user: null })
  })

  it('behaves as done when the settings channel is missing (call rejects)', async () => {
    const state = await readOnboarding({
      getProfile: async () => {
        throw new Error('No handler "getProfile" registered by module "settings"')
      }
    })
    expect(state).toEqual({ firstRun: false, user: null })
  })
})
