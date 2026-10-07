import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aiFailure } from '@shared/ai/errors'
import type { AiService } from '@shared/ai/types'
import type { ContractClient } from '@shared/contract'
import type { AiStatus, SettingsApi } from '@shared/contracts/settings'
import { ok, type Result } from '@shared/result'
import { KeyStore, type Encryptor } from '../keyStore'
import { createSettingsStore } from '../settingsStore'
import { UsageLog } from '../usageLog'
import { createSettingsApi } from './createSettingsApi'
import { createPreferencesStore } from './preferences'

const KEY = 'sk-ant-api03-SUPERSECRETVALUE-WXYZ'
const NOW = new Date('2026-10-06T09:00:00.000Z')

const encryptor = (available = true): Encryptor => ({
  available: () => available,
  encrypt: (plain) => Uint8Array.from(Buffer.from([...plain].reverse().join(''))),
  decrypt: (data) => [...Buffer.from(data).toString()].reverse().join('')
})

type TestResult = Awaited<ReturnType<AiService['testConnection']>>

let dir: string
let events: AiStatus[]
let testConnection: ReturnType<typeof vi.fn<AiService['testConnection']>>
let usage: UsageLog

function build(available = true): ContractClient<SettingsApi> {
  testConnection = vi.fn<AiService['testConnection']>(async (opts) =>
    ok({ model: opts?.model ?? 'claude-opus-5-5', latencyMs: 12 })
  )
  usage = new UsageLog(join(dir, 'usage.jsonl'), () => NOW)
  const impl = createSettingsApi({
    settings: createSettingsStore(dir),
    keyStore: new KeyStore({ dataDir: dir, encryptor: encryptor(available) }),
    ai: { testConnection },
    usage,
    preferences: createPreferencesStore(dir),
    emit: (status) => events.push(status),
    now: () => NOW
  })
  return impl as ContractClient<SettingsApi>
}

const must = <T extends object>(result: Result<T>): Extract<Result<T>, { ok: true }> => {
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`)
  return result
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'settings-api-'))
  events = []
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('profile', () => {
  it('starts as a fresh install', async () => {
    const api = build()
    expect(must(await api.getProfile()).profile).toEqual({
      name: null,
      subject: null,
      onboarding: { step: 'about', completedAt: null, skippedAi: false },
      claudeConnected: false
    })
  })

  it('trims the name and subject, and turns an empty subject into null', async () => {
    const api = build()
    const saved = must(await api.setProfile({ name: '  Ms Patel ', subject: '  KS3 Science ' }))
    expect(saved.profile).toMatchObject({ name: 'Ms Patel', subject: 'KS3 Science' })
    const cleared = must(await api.setProfile({ subject: '   ' }))
    expect(cleared.profile).toMatchObject({ name: 'Ms Patel', subject: null })
    expect(must(await api.setProfile({ subject: null })).profile.subject).toBeNull()
  })

  it('rejects an empty or over-long name and an over-long subject without saving', async () => {
    const api = build()
    for (const patch of [{ name: '   ' }, { name: 'x'.repeat(41) }, { subject: 'y'.repeat(61) }]) {
      const result = await api.setProfile(patch)
      expect(result).toMatchObject({ ok: false, code: 'invalid-input' })
    }
    expect(must(await api.getProfile()).profile.name).toBeNull()
  })

  it('accepts exactly 40 and 60 characters', async () => {
    const api = build()
    const saved = must(await api.setProfile({ name: 'n'.repeat(40), subject: 's'.repeat(60) }))
    expect(saved.profile.name).toHaveLength(40)
    expect(saved.profile.subject).toHaveLength(60)
  })

  it('refuses input that is not an object or has the wrong types', async () => {
    const api = build()
    expect(await api.setProfile(undefined as never)).toMatchObject({ code: 'invalid-input' })
    expect(await api.setProfile({ name: 5 } as never)).toMatchObject({ code: 'invalid-input' })
    expect(await api.setProfile({ subject: 5 } as never)).toMatchObject({ code: 'invalid-input' })
  })
})

describe('onboarding', () => {
  it('moves through the steps and records completion', async () => {
    const api = build()
    await api.setOnboardingStep('connect')
    expect(must(await api.getProfile()).profile.onboarding.step).toBe('connect')
    await api.completeOnboarding({ skippedAi: true })
    expect(must(await api.getProfile()).profile.onboarding).toEqual({
      step: 'done',
      completedAt: NOW.toISOString(),
      skippedAi: true
    })
  })

  it('records a finished setup with a key as not skipped', async () => {
    const api = build()
    await api.completeOnboarding({ skippedAi: false })
    expect(must(await api.getProfile()).profile.onboarding.skippedAi).toBe(false)
  })

  it('rejects an unknown step', async () => {
    const api = build()
    await expect(api.setOnboardingStep('style' as never)).rejects.toThrow()
  })

  it('survives a relaunch (resumes at the saved step)', async () => {
    await build().setOnboardingStep('connect')
    expect(must(await build().getProfile()).profile.onboarding.step).toBe('connect')
  })
})

describe('API key', () => {
  it('saves a key and reveals only its last four characters', async () => {
    const api = build()
    const saved = must(await api.setApiKey(`  ${KEY.slice(0, 20)}\n${KEY.slice(20)}  `))
    expect(saved.keyLast4).toBe('WXYZ')
    const status = await api.getAiStatus()
    expect(status).toMatchObject({ hasKey: true, keyLast4: 'WXYZ', encryptionAvailable: true })
    expect(must(await api.getProfile()).profile.claudeConnected).toBe(true)
  })

  it('never lets the key out: results, events, files at rest', async () => {
    const api = build()
    const everything: unknown[] = [await api.setApiKey(KEY)]
    everything.push(await api.testConnection(), await api.getAiStatus(), await api.getProfile())
    await api.setModel('sonnet-5.5')
    everything.push(await api.getAiStatus(), events)
    expect(JSON.stringify(everything)).not.toContain('SUPERSECRET')
    const plain = await readFile(join(dir, 'settings.json'), 'utf8')
    const cipher = await readFile(join(dir, 'secrets', 'anthropic.key'), 'utf8')
    expect(plain).not.toContain('SUPERSECRET')
    expect(cipher).not.toContain('SUPERSECRET')
    expect(events.length).toBeGreaterThan(0)
  })

  it('rejects wrong shapes before storing anything', async () => {
    const api = build()
    expect(await api.setApiKey('hello')).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'Claude API keys start with sk-ant-.'
    })
    expect(await api.setApiKey('sk-ant-admin01-abc')).toMatchObject({
      code: 'invalid-input',
      message: 'That’s an Admin key. Create a normal API key instead.'
    })
    expect(await api.setApiKey(42 as never)).toMatchObject({ code: 'invalid-input' })
    expect((await api.getAiStatus()).hasKey).toBe(false)
    expect(events).toEqual([])
  })

  it('fails with io when this computer cannot encrypt, saving nothing', async () => {
    const api = build(false)
    const result = await api.setApiKey(KEY)
    expect(result).toMatchObject({
      ok: false,
      code: 'io',
      message: 'This computer can’t store the key securely, so it wasn’t saved.'
    })
    const status = await api.getAiStatus()
    expect(status).toMatchObject({ hasKey: false, encryptionAvailable: false })
    await expect(readdir(join(dir, 'secrets'))).rejects.toThrow()
  })

  it('clears the last test result when a new key is saved, and emits', async () => {
    const api = build()
    await api.setApiKey(KEY)
    await api.testConnection()
    expect((await api.getAiStatus()).lastTest?.result).toBe('connected')
    await api.setApiKey(`${KEY}2`)
    expect((await api.getAiStatus()).lastTest).toBeNull()
    expect(events.at(-1)).toMatchObject({ hasKey: true, keyLast4: 'XYZ2' })
  })

  it('removes the key and the test result', async () => {
    const api = build()
    await api.setApiKey(KEY)
    await api.testConnection()
    await api.removeApiKey()
    expect(await api.getAiStatus()).toMatchObject({ hasKey: false, keyLast4: null, lastTest: null })
    expect(events.at(-1)).toMatchObject({ hasKey: false })
    expect(must(await api.getProfile()).profile.claudeConnected).toBe(false)
  })
})

describe('testConnection', () => {
  it('tests the stored key with the stored model and remembers the result', async () => {
    const api = build()
    await api.setApiKey(KEY)
    const result = must(await api.testConnection())
    expect(result).toMatchObject({ model: 'opus-5.5', latencyMs: 12 })
    expect(testConnection).toHaveBeenCalledWith({ model: 'claude-opus-5-5' })
    expect(await api.getAiStatus()).toMatchObject({
      lastTest: { result: 'connected', at: NOW.toISOString() }
    })
    expect(events.at(-1)?.lastTest?.result).toBe('connected')
  })

  it('answers no-key without calling Claude when nothing is saved', async () => {
    const api = build()
    expect(await api.testConnection()).toMatchObject({
      ok: false,
      code: 'no-key',
      message: 'Claude isn’t connected. Add your API key to keep going.'
    })
    expect(testConnection).not.toHaveBeenCalled()
  })

  it.each([
    ['invalid-key', 'Claude isn’t connected. Add your API key to keep going.'],
    ['no-credit', 'Your Claude account is out of credit.'],
    ['network', 'Can’t reach Claude. Check your internet connection.'],
    ['overloaded', 'Claude is busy right now. Try again in a minute.']
  ] as const)(
    'passes the %s failure on with its friendly copy and records it',
    async (code, message) => {
      const api = build()
      await api.setApiKey(KEY)
      testConnection.mockResolvedValueOnce(aiFailure(code))
      expect(await api.testConnection()).toMatchObject({ ok: false, code, message })
      expect((await api.getAiStatus()).lastTest?.result).toBe(code)
      expect(events.at(-1)?.lastTest?.result).toBe(code)
    }
  )

  it('names the chosen model when it is unavailable', async () => {
    const api = build()
    await api.setApiKey(KEY)
    await api.setModel('sonnet-5.5')
    testConnection.mockImplementationOnce(async (opts) =>
      aiFailure('model-unavailable', { model: opts?.model })
    )
    const result = await api.testConnection()
    expect(result).toMatchObject({ code: 'model-unavailable' })
    expect(!result.ok && result.message).toContain('Claude Sonnet 5.5')
  })

  it('maps a thrown error or a non-AI code to unknown and strips key-like text', async () => {
    const api = build()
    await api.setApiKey(KEY)
    testConnection.mockRejectedValueOnce(new Error(`boom ${KEY}`))
    const thrown = await api.testConnection()
    expect(thrown).toMatchObject({ ok: false, code: 'unknown' })
    expect(JSON.stringify(thrown)).not.toContain('SUPERSECRET')

    const leaky: TestResult = { ok: false, code: 'cancelled', message: `bad ${KEY} here` }
    testConnection.mockResolvedValueOnce(leaky)
    const second = await api.testConnection()
    expect(JSON.stringify(second)).not.toContain('SUPERSECRET')
    expect((await api.getAiStatus()).lastTest?.result).toBe('unknown')
  })

  it('keeps retryAfterSeconds on a rate-limit failure', async () => {
    const api = build()
    await api.setApiKey(KEY)
    testConnection.mockResolvedValueOnce(aiFailure('rate-limited', { retryAfterSeconds: 30 }))
    expect(await api.testConnection()).toMatchObject({
      code: 'rate-limited',
      retryAfterSeconds: 30
    })
  })
})

describe('model', () => {
  it('defaults to Opus, saves the choice, clears the last test and emits', async () => {
    const api = build()
    expect((await api.getAiStatus()).model).toBe('opus-5.5')
    await api.setApiKey(KEY)
    await api.testConnection()
    await api.setModel('sonnet-5.5')
    expect(await api.getAiStatus()).toMatchObject({ model: 'sonnet-5.5', lastTest: null })
    expect(events.at(-1)?.model).toBe('sonnet-5.5')
    expect(JSON.parse(await readFile(join(dir, 'settings.json'), 'utf8')).model).toBe(
      'claude-sonnet-5-5'
    )
  })

  it('rejects an unknown model', async () => {
    await expect(build().setModel('gpt' as never)).rejects.toThrow()
  })
})

describe('usage', () => {
  it('reports this month from the usage log', async () => {
    const api = build()
    expect(await api.getUsage()).toEqual({ month: '2026-10', calls: 0, costUsd: 0 })
    await usage.record({
      model: 'claude-opus-5-5',
      task: 'chatTurn',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    })
    expect(await api.getUsage()).toEqual({ month: '2026-10', calls: 1, costUsd: 4 })
  })
})

describe('preferences', () => {
  it('returns defaults, merges partial updates and ignores undefined values', async () => {
    const api = build()
    expect(await api.getPreferences()).toEqual({
      homeSort: 'edited',
      lastLengthMin: null,
      lastYearGroup: null,
      lastAbility: null,
      assetsMenuUses: 0
    })
    await api.setPreferences({ homeSort: 'title', lastLengthMin: 50 })
    await api.setPreferences({ lastYearGroup: 'Year 8', lastLengthMin: undefined })
    await api.setPreferences({ assetsMenuUses: 3 })
    expect(await api.getPreferences()).toMatchObject({
      homeSort: 'title',
      lastLengthMin: 50,
      lastYearGroup: 'Year 8',
      assetsMenuUses: 3
    })
  })

  it('rejects invalid values', async () => {
    await expect(build().setPreferences({ homeSort: 'random' as never })).rejects.toThrow()
  })
})
