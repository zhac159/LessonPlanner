/** Reads the picture maker's settings from the settings folder (the Google key and `picture-maker.json`). */
import { KeyStore, createSafeStorageEncryptor } from '../../keyStore'
import { createPictureMakerStore } from '../../settingsModule/pictureMakerStore'
import type { PictureMakerSettings } from './types'

export function pictureMakerSettingsFrom(settingsDir: string): PictureMakerSettings {
  const keys = new KeyStore({
    dataDir: settingsDir,
    encryptor: createSafeStorageEncryptor(),
    name: 'google'
  })
  const store = createPictureMakerStore(settingsDir)
  return {
    hasKey: () => keys.hasKey(),
    getKey: async () => {
      const result = await keys.get()
      return result.ok ? result.key : undefined
    },
    model: async () => (await store.get()).model,
    lastTest: async () => (await store.get()).lastTest?.result ?? null
  }
}

export const claudeKeyFrom = (settingsDir: string): (() => Promise<boolean>) => {
  const keys = new KeyStore({ dataDir: settingsDir, encryptor: createSafeStorageEncryptor() })
  return () => keys.hasKey()
}
