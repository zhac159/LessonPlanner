import { describe, expect, it } from 'vitest'
import { fail, ok } from '../result'
import type { ContractClient } from '../contract'
import { invalidChannels } from './channelPattern.test'
import {
  SETTINGS,
  SETTINGS_EVENTS,
  SETTINGS_METHODS,
  type AiStatus,
  type Preferences,
  type SettingsApi,
  type UserProfile
} from './settings'

describe('settings contract', () => {
  it('serves the module id the bus routes on', () => {
    expect(SETTINGS).toBe('settings')
  })

  it('uses valid, unique channel and event names', () => {
    expect(invalidChannels(SETTINGS_METHODS)).toEqual([])
    expect(invalidChannels(SETTINGS_EVENTS)).toEqual([])
  })

  it('maps every method to a promise-returning client method', async () => {
    const client: Pick<ContractClient<SettingsApi>, 'getAiStatus'> = {
      getAiStatus: async () => ({
        hasKey: false,
        keyLast4: null,
        model: 'sonnet-5.5',
        lastTest: null,
        encryptionAvailable: true
      })
    }
    expect((await client.getAiStatus()).hasKey).toBe(false)
  })

  it('describes a fresh install and a connected account', () => {
    const fresh = {
      name: null,
      subject: null,
      onboarding: { step: 'about', completedAt: null, skippedAi: false },
      claudeConnected: false
    } satisfies UserProfile
    const status = {
      hasKey: true,
      keyLast4: 'x9Qa',
      model: 'sonnet-5.5',
      lastTest: { result: 'invalid-key', at: '2026-10-06T09:00:00Z' },
      encryptionAvailable: true
    } satisfies AiStatus
    const prefs = {
      homeSort: 'edited',
      lastLengthMin: null,
      lastYearGroup: 'Year 8',
      lastAbility: null,
      assetsMenuUses: 0
    } satisfies Preferences
    expect([fresh.name, status.hasKey, prefs.homeSort]).toEqual([null, true, 'edited'])
  })

  it('lets the UI tell failures apart with Result', () => {
    const results: ReturnType<SettingsApi['setApiKey']>[] = [
      ok({ keyLast4: 'abcd' }),
      fail('invalid-input', 'That does not look like a key')
    ]
    const codes = results.map((r) => (r.ok ? r.keyLast4 : r.code))
    expect(codes).toEqual(['abcd', 'invalid-input'])
  })
})
