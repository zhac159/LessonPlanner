/**
 * Small typed JSON store for app preferences: `<dataDir>/settings.json`, atomic writes, in-memory cache,
 * serialised updates (two quick `update` calls never lose each other's changes). `createJsonStore` is generic
 * so other modules can reuse it; `createSettingsStore` is the app's instance (name, subject, onboarding, model).
 */
import { join } from 'node:path'
import { z } from 'zod'
import { DEFAULT_MODEL } from '@shared/ai/prices'
import { atomicWriteJson, readJsonSafe } from './fsx'

export interface JsonStore<T extends object> {
  /** The current value (defaults + whatever is valid on disk). Never throws. */
  get(): Promise<T>
  /** Merges a partial (or applies a function) and saves atomically; resolves with the saved value. */
  update(change: Partial<T> | ((current: T) => T)): Promise<T>
  /** Back to defaults. */
  reset(): Promise<T>
}

export interface JsonStoreOptions<T extends object> {
  file: string
  /** Validates what is read from disk and every update. */
  schema: z.ZodType<T>
  defaults: T
}

export function createJsonStore<T extends object>({
  file,
  schema,
  defaults
}: JsonStoreOptions<T>): JsonStore<T> {
  let cache: T | undefined
  let queue: Promise<unknown> = Promise.resolve()

  async function load(): Promise<T> {
    if (cache) return cache
    const raw = await readJsonSafe<Record<string, unknown>>(file)
    const merged = raw && typeof raw === 'object' ? { ...defaults, ...raw } : defaults
    const parsed = schema.safeParse(merged)
    cache = parsed.success ? parsed.data : { ...defaults }
    return cache
  }

  /** Runs `task` after every earlier one, whether or not they failed. */
  const serial = <R>(task: () => Promise<R>): Promise<R> => {
    const next = queue.then(task, task)
    queue = next.catch(() => undefined)
    return next
  }

  async function save(next: T): Promise<T> {
    await atomicWriteJson(file, next)
    cache = next
    return next
  }

  return {
    get: () => serial(load),
    update: (change) =>
      serial(async () => {
        const current = await load()
        const next = typeof change === 'function' ? change(current) : { ...current, ...change }
        return save(schema.parse(next))
      }),
    reset: () => serial(() => save({ ...defaults }))
  }
}

export const ONBOARDING_STEPS = ['about', 'connect', 'style', 'done'] as const

export const settingsSchema = z.object({
  /** The teacher's name (data, not code). */
  name: z.string(),
  subject: z.string(),
  onboarding: z.object({
    step: z.enum(ONBOARDING_STEPS),
    skippedAi: z.boolean(),
    completedAt: z.string().nullable()
  }),
  model: z.enum(['claude-opus-5-5', 'claude-sonnet-5-5']),
  /** Result of the last "Test connection", shown as a pill in Settings › AI. */
  lastTest: z.object({ result: z.string(), at: z.string() }).nullable()
})

export type AppSettings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  name: '',
  subject: '',
  onboarding: { step: 'about', skippedAi: false, completedAt: null },
  model: DEFAULT_MODEL,
  lastTest: null
}

export type SettingsStore = JsonStore<AppSettings>

/** The app's settings file inside `dataDir`. */
export function createSettingsStore(dataDir: string): SettingsStore {
  return createJsonStore({
    file: join(dataDir, 'settings.json'),
    schema: settingsSchema,
    defaults: DEFAULT_SETTINGS
  })
}
