/**
 * The settings module's implementation of `SettingsApi`, built from injected services so tests need no
 * Electron. Rules (design/screens/01-welcome.md §6, 02-connect-claude.md §6): the API key is only ever
 * handed to the key store; nothing returned, emitted or thrown here contains it, only its last four characters.
 */
import { NOT_CONNECTED, aiFailure } from '@shared/ai/errors'
import type { ContractImpl } from '@shared/contract'
import { normaliseApiKey, redactApiKeys } from '@shared/ai/keyFormat'
import type { AiService } from '@shared/ai/types'
import type { AiStatus, OnboardingStep, SettingsApi, UserProfile } from '@shared/contracts/settings'
import { fail, ok, type AiErrorCode, type Failure } from '@shared/result'
import type { KeyStore } from '../keyStore'
import type { AppSettings, SettingsStore } from '../settingsStore'
import type { UsageLog } from '../usageLog'
import type { PictureMakerMethods } from './createPictureMakerApi'
import { isUiModel, toApiModel, toUiModel } from './models'
import type { PreferencesStore } from './preferences'
import { validateProfilePatch } from './profile'

export interface SettingsApiDeps {
  settings: SettingsStore
  keyStore: Pick<KeyStore, 'hasKey' | 'lastFour' | 'set' | 'clear' | 'encryptionAvailable'>
  ai: Pick<AiService, 'testConnection'>
  usage: Pick<UsageLog, 'monthSummary'>
  preferences: PreferencesStore
  /** Pushes `aiStatusChanged` to the renderer. */
  emit: (status: AiStatus) => void
  now?: () => Date
}

const STEPS: readonly OnboardingStep[] = ['about', 'connect', 'done']
const AI_CODES: readonly string[] = [
  'no-key',
  'invalid-key',
  'no-credit',
  'permission',
  'model-unavailable',
  'rate-limited',
  'overloaded',
  'network',
  'too-large',
  'refused',
  'unknown'
]

const asAiCode = (code: string): AiErrorCode =>
  AI_CODES.includes(code) ? (code as AiErrorCode) : 'unknown'

const asStep = (step: string): OnboardingStep =>
  STEPS.includes(step as OnboardingStep) ? (step as OnboardingStep) : 'done'

/** The settings API without the picture-maker methods (`createPictureMakerApi` serves those). */
export type CoreSettingsApi = Omit<ContractImpl<SettingsApi>, PictureMakerMethods>

/** Builds the profile, Claude and preferences API. Every method is safe to call with untrusted renderer input. */
export function createSettingsApi(deps: SettingsApiDeps): CoreSettingsApi {
  const { settings, keyStore, ai, usage, preferences } = deps
  const now = deps.now ?? (() => new Date())

  async function status(): Promise<AiStatus> {
    const [current, hasKey] = await Promise.all([settings.get(), keyStore.hasKey()])
    return {
      hasKey,
      keyLast4: hasKey ? await keyStore.lastFour() : null,
      model: toUiModel(current.model),
      lastTest:
        hasKey && current.lastTest
          ? {
              result:
                current.lastTest.result === 'connected'
                  ? 'connected'
                  : asAiCode(current.lastTest.result),
              at: current.lastTest.at
            }
          : null,
      encryptionAvailable: keyStore.encryptionAvailable()
    }
  }

  async function publish(): Promise<void> {
    deps.emit(await status())
  }

  const profileOf = async (current: AppSettings): Promise<UserProfile> => ({
    name: current.name || null,
    subject: current.subject || null,
    onboarding: {
      step: asStep(current.onboarding.step),
      completedAt: current.onboarding.completedAt,
      skippedAi: current.onboarding.skippedAi
    },
    claudeConnected: await keyStore.hasKey()
  })

  const failure = (result: Failure): Failure => ({
    ...result,
    message: redactApiKeys(result.message)
  })

  return {
    async getProfile() {
      return ok({ profile: await profileOf(await settings.get()) })
    },

    async setProfile(patch) {
      const checked = validateProfilePatch(patch)
      if (!checked.ok) return checked
      const saved = await settings.update(checked.change)
      return ok({ profile: await profileOf(saved) })
    },

    async setOnboardingStep(step) {
      if (!STEPS.includes(step)) throw new Error('Unknown onboarding step')
      await settings.update((s) => ({
        ...s,
        onboarding: {
          ...s.onboarding,
          step,
          completedAt: step === 'done' ? (s.onboarding.completedAt ?? now().toISOString()) : null
        }
      }))
    },

    getAiStatus: status,

    async setApiKey(key) {
      const checked = normaliseApiKey(typeof key === 'string' ? key : '')
      if (!checked.ok) return checked
      const saved = await keyStore.set(checked.key)
      if (!saved.ok) return failure(saved)
      await settings.update({ lastTest: null })
      await publish()
      return ok({ keyLast4: saved.lastFour })
    },

    async testConnection() {
      if (!(await keyStore.hasKey())) return fail('no-key', NOT_CONNECTED)
      const { model } = await settings.get()
      let result: Awaited<ReturnType<AiService['testConnection']>>
      try {
        result = await ai.testConnection({ model })
      } catch {
        result = aiFailure('unknown')
      }
      const outcome = result.ok ? 'connected' : asAiCode(result.code)
      await settings.update({ lastTest: { result: outcome, at: now().toISOString() } })
      await publish()
      if (!result.ok) return failure(result)
      return ok({ model: toUiModel(result.model), latencyMs: result.latencyMs })
    },

    async setModel(model) {
      if (!isUiModel(model)) throw new Error('Unknown model')
      await settings.update({ model: toApiModel(model), lastTest: null })
      await publish()
    },

    async removeApiKey() {
      await keyStore.clear()
      await settings.update({ lastTest: null })
      await publish()
    },

    async completeOnboarding(opts) {
      await settings.update((s) => ({
        ...s,
        onboarding: {
          step: 'done',
          skippedAi: opts.skippedAi === true,
          completedAt: s.onboarding.completedAt ?? now().toISOString()
        }
      }))
    },

    async getUsage() {
      const { month, calls, costUsd } = await usage.monthSummary()
      return { month, calls, costUsd }
    },

    getPreferences: () => preferences.get(),

    async setPreferences(patch) {
      const defined = Object.fromEntries(
        Object.entries(patch ?? {}).filter(([, value]) => value !== undefined)
      )
      await preferences.update(defined)
    }
  }
}
