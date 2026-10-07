/** A stateful fake of the settings contract for component tests (imported by `*.test.tsx` only). */
import type { ContractClient, ContractImpl } from '@shared/contract'
import type {
  AiStatus,
  PictureMakerStatus,
  SettingsApi,
  UserProfile
} from '@shared/contracts/settings'
import { fail, ok } from '@shared/result'
import { fakeClient } from '@test/render'

export const FRESH_PROFILE: UserProfile = {
  name: null,
  subject: null,
  onboarding: { step: 'about', completedAt: null, skippedAi: false },
  claudeConnected: false
}

export const NO_KEY: AiStatus = {
  hasKey: false,
  keyLast4: null,
  model: 'opus-5.5',
  lastTest: null,
  encryptionAvailable: true
}

export const SAVED_KEY: AiStatus = { ...NO_KEY, hasKey: true, keyLast4: 'WXYZ' }

export const TYPED_KEY = 'sk-ant-api03-SECRETVALUE-1234'

export const NO_PICTURE_MAKER: PictureMakerStatus = {
  hasKey: false,
  keyLast4: null,
  model: 'gemini-3-pro-image',
  lastTest: null,
  skipped: false,
  encryptionAvailable: true
}

export const SAVED_PICTURE_MAKER: PictureMakerStatus = {
  ...NO_PICTURE_MAKER,
  hasKey: true,
  keyLast4: 'cdef'
}

/** A 39-character Google-shaped key for typing in tests. */
export const TYPED_GOOGLE_KEY = 'AIzaSyD-SECRETSECRETSECRETSECRET0123456'

export interface FakeSettingsOptions {
  profile?: Partial<UserProfile>
  status?: Partial<AiStatus>
  picture?: Partial<PictureMakerStatus>
  /** Replaces any method; the others keep the stateful behaviour. */
  overrides?: Partial<ContractImpl<SettingsApi>>
}

/** A settings client whose state follows the calls, so the UI under test sees realistic answers. */
export function fakeSettings({
  profile: profileInit,
  status: statusInit,
  picture: pictureInit,
  overrides
}: FakeSettingsOptions = {}): ContractClient<SettingsApi> {
  let profile: UserProfile = { ...FRESH_PROFILE, ...profileInit }
  let status: AiStatus = { ...NO_KEY, ...statusInit }
  let picture: PictureMakerStatus = { ...NO_PICTURE_MAKER, ...pictureInit }
  const at = '2026-10-06T09:00:00.000Z'
  return fakeClient<SettingsApi>({
    getProfile: () => ok({ profile }),
    setProfile: (patch) => {
      profile = {
        ...profile,
        ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
        ...(patch.subject === undefined ? {} : { subject: patch.subject?.trim() || null })
      }
      return ok({ profile })
    },
    setOnboardingStep: (step) => {
      profile = { ...profile, onboarding: { ...profile.onboarding, step } }
    },
    getAiStatus: () => status,
    setApiKey: (key) => {
      status = { ...status, hasKey: true, keyLast4: key.slice(-4), lastTest: null }
      return ok({ keyLast4: key.slice(-4) })
    },
    testConnection: () => {
      status = { ...status, lastTest: { result: 'connected', at } }
      return ok({ model: status.model, latencyMs: 5 })
    },
    setModel: (model) => {
      status = { ...status, model, lastTest: null }
    },
    removeApiKey: () => {
      status = { ...status, hasKey: false, keyLast4: null, lastTest: null }
    },
    completeOnboarding: ({ skippedAi }) => {
      profile = { ...profile, onboarding: { step: 'done', completedAt: at, skippedAi } }
    },
    getUsage: () => ({ month: '2026-10', calls: 3, costUsd: 1.234 }),
    getPreferences: () => ({
      homeSort: 'edited',
      lastLengthMin: null,
      lastYearGroup: null,
      lastAbility: null,
      assetsMenuUses: 0
    }),
    setPreferences: () => {},
    getPictureMakerStatus: () => picture,
    setPictureMakerKey: (key) => {
      if (!/^(AIza|AQ\.)/.test(key))
        return fail(
          'invalid-input',
          'That doesn’t look like a Google key. They start with AIza or AQ.'
        )
      picture = {
        ...picture,
        hasKey: true,
        keyLast4: key.slice(-4),
        lastTest: null,
        skipped: false
      }
      return ok({ keyLast4: key.slice(-4) })
    },
    testPictureMaker: () => {
      picture = { ...picture, lastTest: { result: 'connected', at } }
      return ok({ model: picture.model, latencyMs: 5 })
    },
    setPictureMakerModel: (model) => {
      picture = { ...picture, model, lastTest: null }
    },
    removePictureMakerKey: () => {
      picture = { ...picture, hasKey: false, keyLast4: null, lastTest: null }
    },
    skipPictureMaker: () => {
      picture = { ...picture, skipped: true }
    },
    ...overrides
  })
}
