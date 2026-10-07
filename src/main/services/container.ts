/**
 * The app's main-process services, built lazily from the data folder and shared by every module's
 * main.ts (settings, style-library, deck-builder). One place decides how the AI service, the encrypted
 * key store, the settings file and the usage log are created, so modules never build their own.
 *
 * Tests inject a container with `setContainer`; code uses `getContainer()`.
 */
import { join } from 'node:path'
import { createAiService } from '../ai'
import { DEFAULT_MODEL } from '@shared/ai/prices'
import type { AiService, ModelChoice } from '@shared/ai/types'
import { KeyStore, createSafeStorageEncryptor } from './keyStore'
import { moduleDataDir } from './paths'
import { createSettingsStore, type SettingsStore } from './settingsStore'
import { UsageLog } from './usageLog'

export interface Container {
  /** Where settings, the encrypted key and the usage log live: `<dataRoot>/modules/settings`. */
  settingsDir: string
  settings: SettingsStore
  keyStore: KeyStore
  usage: UsageLog
  /** Claude behind the AiService interface; the deterministic fake when SLIDE_PLANNER_FAKE_AI=1. */
  ai: AiService
}

export interface ContainerOptions {
  settingsDir?: string
  fakeAi?: boolean
}

export function createContainer(options: ContainerOptions = {}): Container {
  const settingsDir = options.settingsDir ?? moduleDataDir('settings')
  const settings = createSettingsStore(settingsDir)
  const keyStore = new KeyStore({ dataDir: settingsDir, encryptor: createSafeStorageEncryptor() })
  const usage = new UsageLog(join(settingsDir, 'usage.jsonl'))
  // `getModel` is synchronous in AiServiceDeps: keep the teacher's last choice warm.
  let cachedModel: ModelChoice = DEFAULT_MODEL
  const fake = options.fakeAi ?? process.env.SLIDE_PLANNER_FAKE_AI === '1'
  const ai = createAiService({
    fake,
    usage,
    getApiKey: async () => {
      const result = await keyStore.get()
      return result.ok ? result.key : null
    },
    getModel: () => cachedModel
  })
  void settings.get().then((s) => (cachedModel = s.model))
  const originalUpdate = settings.update.bind(settings)
  settings.update = async (change) => {
    const next = await originalUpdate(change)
    cachedModel = next.model
    return next
  }
  return { settingsDir, settings, keyStore, usage, ai }
}

let current: Container | null = null

/** The shared container (created on first use). */
export function getContainer(): Container {
  current ??= createContainer()
  return current
}

/** Replace (or clear with null) the shared container: for tests. */
export function setContainer(container: Container | null): void {
  current = container
}
