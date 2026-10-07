/**
 * `describe-cache.json`: sha256 -> what Claude said about the picture, so a picture is described once, ever
 * (agents/ASSETS.md §2.7, §5.2). Implements the AI layer's `DescribeCache`, so the app can hand the same object to
 * `createAiService({ describeCache })`. Loaded on first use; a missing or broken file is an empty cache; writes are
 * queued so two saves can never finish out of order.
 */
import { join } from 'node:path'
import type { PictureFacts } from '../../../ai/schemas/pictures'
import type { DescribeCache } from '../../../ai/calls/pictures'
import { atomicWriteJson, readJsonSafe } from '../../fsx'

export const DESCRIBE_CACHE_FILE = 'describe-cache.json'
const MAX_ENTRIES = 3000

interface CacheFile {
  schemaVersion: 1
  entries: Record<string, PictureFacts>
}

const isFacts = (value: unknown): value is PictureFacts =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PictureFacts).name === 'string' &&
  typeof (value as PictureFacts).title === 'string' &&
  typeof (value as PictureFacts).kind === 'string' &&
  Array.isArray((value as PictureFacts).tags)

export interface FileDescribeCache extends DescribeCache {
  /** Resolves when every queued write has finished (tests, shutdown). */
  flush(): Promise<void>
}

export function createFileDescribeCache(dir: string): FileDescribeCache {
  const file = join(dir, DESCRIBE_CACHE_FILE)
  let entries: Map<string, PictureFacts> | null = null
  let saving: Promise<void> = Promise.resolve()

  const load = async (): Promise<Map<string, PictureFacts>> => {
    if (entries) return entries
    const raw = await readJsonSafe<CacheFile>(file)
    const map = new Map<string, PictureFacts>()
    for (const [sha, facts] of Object.entries(raw?.entries ?? {})) {
      if (isFacts(facts)) map.set(sha, facts)
    }
    return (entries ??= map)
  }

  return {
    async get(sha256) {
      const hit = (await load()).get(sha256)
      return hit && structuredClone(hit)
    },
    async set(sha256, facts) {
      const map = await load()
      map.delete(sha256)
      map.set(sha256, structuredClone(facts))
      while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string)
      const snapshot: CacheFile = { schemaVersion: 1, entries: Object.fromEntries(map) }
      saving = saving.then(() => atomicWriteJson(file, snapshot)).catch(() => undefined)
      await saving
    },
    flush: () => saving
  }
}
