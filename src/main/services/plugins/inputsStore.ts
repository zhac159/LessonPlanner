/** The options each plugin was last run with, so the sheet opens with them (07 §6). One small JSON file. */
import { atomicWriteJson, readJsonSafe } from '../fsx'

type Saved = Record<string, Record<string, unknown>>

const isSaved = (raw: unknown): Saved => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('not an object')
  return raw as Saved
}

export class PluginInputsStore {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly file: string) {}

  /** The last inputs for a plugin, or null. */
  async get(pluginId: string): Promise<Record<string, unknown> | null> {
    const saved = await readJsonSafe(this.file, isSaved)
    return saved?.[pluginId] ?? null
  }

  /** Remembers the inputs of a run (writes are queued, so two runs never lose each other's). */
  set(pluginId: string, inputs: Record<string, unknown>): Promise<void> {
    const write = async (): Promise<void> => {
      const saved = (await readJsonSafe(this.file, isSaved)) ?? {}
      await atomicWriteJson(this.file, { ...saved, [pluginId]: inputs })
    }
    const next = this.queue.then(write, write)
    this.queue = next.catch(() => undefined)
    return next
  }
}
