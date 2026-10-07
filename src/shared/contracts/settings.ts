/**
 * Contract of the `settings` module: profile, onboarding, Claude connection and preferences
 * (design/screens/01-welcome.md, 02-connect-claude.md, 03-home.md §6, 05-new-lesson.md §6).
 * The API key never crosses IPC after `setApiKey`; only `keyLast4` does.
 */
import type { AiErrorCode, Result } from '../result'
import { keysOf } from './names'

export const SETTINGS = 'settings' as const

export type OnboardingStep = 'about' | 'connect' | 'done'

/** The user's profile; `name` is null on a fresh install (01 §6). */
export interface UserProfile {
  name: string | null
  subject: string | null
  onboarding: { step: OnboardingStep; completedAt: string | null; skippedAi: boolean }
  /** Convenience mirror of `AiStatus.hasKey` so the shell needs a single call (never the key itself). */
  claudeConnected: boolean
}

/** The two models the user can pick; settings main resolves them to API ids in one table (02 §6). */
export type ModelChoice = 'opus-5.5' | 'sonnet-5.5'

/** Everything the UI may know about the Claude connection (02 §6). */
export interface AiStatus {
  hasKey: boolean
  keyLast4: string | null
  model: ModelChoice
  lastTest: { result: 'connected' | AiErrorCode; at: string } | null
  encryptionAvailable: boolean
}

/**
 * The two picture makers the teacher can choose (agents/ASSETS.md §4.4). The ids are Google's model ids; their
 * prices and the HTTP call live in src/main/services/imageProviders/nanoBanana.ts.
 */
export type PictureMakerModel = 'gemini-3-pro-image' | 'gemini-nano-banana-2.1'

/** Everything the UI may know about the optional picture maker (A7). The Google key never appears, only its end. */
export interface PictureMakerStatus {
  hasKey: boolean
  keyLast4: string | null
  model: PictureMakerModel
  /** The latest free key check; `connected` = the key works and the chosen model is listed for it. */
  lastTest: { result: 'connected' | AiErrorCode; at: string } | null
  /** The teacher pressed "Skip, I'll add it later" on the first-run step and has not added a key since. */
  skipped: boolean
  encryptionAvailable: boolean
}

export type HomeSort = 'edited' | 'title' | 'year'

/** Remembered choices: Home sort and the New lesson set-up defaults (03 §6, 05 §6). */
export interface Preferences {
  homeSort: HomeSort
  lastLengthMin: number | null
  lastYearGroup: string | null
  lastAbility: string | null
  /** How often the "+" menu's Add asset entry was used; drives the "New" pill (ASSETS §3.3). */
  assetsMenuUses: number
}

/** This month's Claude spend for Settings › AI: "This month: about $X" (02 §8 step 9). */
export interface UsageSummary {
  /** `YYYY-MM`, local time. */
  month: string
  calls: number
  costUsd: number
}

export interface SettingsApi {
  /** Profile for the greeting, splash and user chip (01 §6). */
  getProfile(): Result<{ profile: UserProfile }>
  /** Trims and validates (name 1–40, subject 0–60 characters); codes: 'invalid-input' (01 §6). */
  setProfile(patch: { name?: string; subject?: string | null }): Result<{ profile: UserProfile }>
  /** Moves the first-run wizard on (01 §6). */
  setOnboardingStep(step: OnboardingStep): void
  /** Connection state for the user chip and the not-connected callout (02 §6). */
  getAiStatus(): AiStatus
  /** Stores the key encrypted; codes: 'invalid-input', 'io' when encryption is unavailable (02 §6). */
  setApiKey(key: string): Result<{ keyLast4: string }>
  /** Tests the STORED key with the stored model; failure codes are AiErrorCode (02 §6). */
  testConnection(): Result<{ model: ModelChoice; latencyMs: number }>
  /** Chooses the model used for all calls (02 §6). */
  setModel(model: ModelChoice): void
  /** Deletes the stored key (Settings › AI only) (02 §6). */
  removeApiKey(): void
  /** Ends first-run; `skippedAi` is true when the user skipped connecting Claude (02 §6). */
  completeOnboarding(opts: { skippedAi: boolean }): void
  /** This month's usage figure from `usage.jsonl` (02 §8 step 9; additive to the original contract). */
  getUsage(): UsageSummary
  /** Connection state of the optional picture maker (A7). */
  getPictureMakerStatus(): PictureMakerStatus
  /** Stores the Google key encrypted; codes: 'invalid-input' unless it looks like a Google key, 'io' without encryption. */
  setPictureMakerKey(key: string): Result<{ keyLast4: string }>
  /**
   * Checks the STORED key with a FREE request (lists the models, no picture is made, nothing is billed) and
   * that the chosen model is offered. Failure codes are AiErrorCode: 'invalid-key', 'model-unavailable', ...
   * A key can pass this and still fail later when billing is off: Google only says so when a picture is made.
   */
  testPictureMaker(): Result<{ model: PictureMakerModel; latencyMs: number }>
  /** Chooses the picture maker model; the old test result is forgotten. */
  setPictureMakerModel(model: PictureMakerModel): void
  /** Deletes the stored Google key (Settings › AI). */
  removePictureMakerKey(): void
  /** Records "Skip, I'll add it later" on the first-run step. */
  skipPictureMaker(): void
  /** Remembered sort and set-up choices (03 §6, 05 §6). */
  getPreferences(): Preferences
  /** Merges a partial update (03 §6). */
  setPreferences(patch: Partial<Preferences>): void
}

export interface SettingsEvents {
  /** The connection state changed: key set or removed, test finished, model changed (02 §6). */
  aiStatusChanged: AiStatus
}

/**
 * The picture maker's event (A7). Kept apart from `SettingsEvents` on purpose: `useEvent<SettingsEvents>(…)` callers
 * type their handler with the union of all payloads, so a second event there would break the existing ones.
 * Subscribe with `useEvent<PictureMakerEvents>(SETTINGS, 'pictureMakerStatusChanged', …)`.
 */
export interface PictureMakerEvents {
  /** The key, model, test result or skipped flag changed. */
  pictureMakerStatusChanged: PictureMakerStatus
}

export const SETTINGS_METHODS = keysOf<SettingsApi>()([
  'getProfile',
  'setProfile',
  'setOnboardingStep',
  'getAiStatus',
  'setApiKey',
  'testConnection',
  'setModel',
  'removeApiKey',
  'completeOnboarding',
  'getUsage',
  'getPreferences',
  'setPreferences',
  'getPictureMakerStatus',
  'setPictureMakerKey',
  'testPictureMaker',
  'setPictureMakerModel',
  'removePictureMakerKey',
  'skipPictureMaker'
])

export const SETTINGS_EVENTS = keysOf<SettingsEvents & PictureMakerEvents>()([
  'aiStatusChanged',
  'pictureMakerStatusChanged'
])
