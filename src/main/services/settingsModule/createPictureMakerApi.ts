/**
 * The picture-maker half of `SettingsApi` (A7, agents/ASSETS.md §4.4), built from injected services so tests
 * need no Electron or network. Same rules as the Claude key (02 §6): the Google key is only ever handed to the
 * key store and to the free key check; nothing returned, emitted or thrown here contains it, only its last four
 * characters.
 */
import type { ContractImpl } from '@shared/contract'
import type { PictureMakerStatus, SettingsApi } from '@shared/contracts/settings'
import { fail, ok, type AiErrorCode, type Failure } from '@shared/result'
import type { KeyStore } from '../keyStore'
import type { FetchFn } from '../imageProviders/types'
import { checkGoogleKey, looksLikeGoogleApiKey, redactGoogleKeys } from './googleCheck'
import { isPictureMakerModel, type PictureMakerStore } from './pictureMakerStore'

export const NOT_A_GOOGLE_KEY = 'That doesn’t look like a Google key. They start with AIza or AQ.'
export const NO_PICTURE_KEY = 'Add a Google picture-maker key first.'

/** The six methods this file serves; `createSettingsApi` serves the rest. */
export type PictureMakerMethods =
  | 'getPictureMakerStatus'
  | 'setPictureMakerKey'
  | 'testPictureMaker'
  | 'setPictureMakerModel'
  | 'removePictureMakerKey'
  | 'skipPictureMaker'

export interface PictureMakerApiDeps {
  store: PictureMakerStore
  keyStore: Pick<KeyStore, 'hasKey' | 'lastFour' | 'get' | 'set' | 'clear' | 'encryptionAvailable'>
  fetchFn: FetchFn
  /** Pushes `pictureMakerStatusChanged` to the renderer. */
  emit: (status: PictureMakerStatus) => void
  now?: () => Date
}

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

export function createPictureMakerApi(
  deps: PictureMakerApiDeps
): Pick<ContractImpl<SettingsApi>, PictureMakerMethods> {
  const { store, keyStore, fetchFn } = deps
  const now = deps.now ?? (() => new Date())

  async function status(): Promise<PictureMakerStatus> {
    const [current, hasKey] = await Promise.all([store.get(), keyStore.hasKey()])
    return {
      hasKey,
      keyLast4: hasKey ? await keyStore.lastFour() : null,
      model: current.model,
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
      skipped: current.skipped,
      encryptionAvailable: keyStore.encryptionAvailable()
    }
  }

  const publish = async (): Promise<void> => deps.emit(await status())

  return {
    getPictureMakerStatus: status,

    async setPictureMakerKey(key) {
      const typed = typeof key === 'string' ? key.replace(/\s+/g, '') : ''
      if (!looksLikeGoogleApiKey(typed)) return fail('invalid-input', NOT_A_GOOGLE_KEY)
      const saved = await keyStore.set(typed)
      if (!saved.ok) return { ...saved, message: redactGoogleKeys(saved.message, typed) } as Failure
      await store.update({ lastTest: null, skipped: false })
      await publish()
      return ok({ keyLast4: saved.lastFour })
    },

    async testPictureMaker() {
      const stored = await keyStore.get()
      if (!stored.ok) return fail('no-key', NO_PICTURE_KEY)
      const { model } = await store.get()
      const started = Date.now()
      const result = await checkGoogleKey({ key: stored.key, model, fetchFn }).catch(() =>
        fail('unknown', 'Something went wrong.')
      )
      const latencyMs = Date.now() - started
      await store.update({
        lastTest: {
          result: result.ok ? 'connected' : asAiCode(result.code),
          at: now().toISOString()
        }
      })
      await publish()
      if (!result.ok) return { ...result, message: redactGoogleKeys(result.message, stored.key) }
      return ok({ model, latencyMs })
    },

    async setPictureMakerModel(model) {
      if (!isPictureMakerModel(model)) throw new Error('Unknown picture maker model')
      await store.update({ model, lastTest: null })
      await publish()
    },

    async removePictureMakerKey() {
      await keyStore.clear()
      await store.update({ lastTest: null })
      await publish()
    },

    async skipPictureMaker() {
      await store.update({ skipped: true })
      await publish()
    }
  }
}
