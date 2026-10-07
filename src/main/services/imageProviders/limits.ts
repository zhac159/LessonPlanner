/**
 * Being polite to free services: a serial queue with a minimum gap between requests, and a small in-memory cache
 * (with in-flight sharing) for repeated queries. Openverse allows an anonymous app only 20 searches a minute and
 * 200 a day, so repeats (paging back, reopening a spot's tab) must never reach the network.
 */
import type { ImageSearchProvider, ImageSearchParams, ImageSearchResult } from './types'

export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

/** Runs tasks one at a time, starting each at least `minGapMs` after the previous one started. */
export function createThrottle(minGapMs: number, clock: Clock = realClock) {
  let tail: Promise<unknown> = Promise.resolve()
  let lastStart = -Infinity
  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(async () => {
      const wait = lastStart + minGapMs - clock.now()
      if (wait > 0) await clock.sleep(wait)
      lastStart = clock.now()
      return task()
    })
    tail = run.catch(() => undefined)
    return run
  }
}

export interface QueryCache<T> {
  /** Return the cached value (or the pending request) for `key`, else start `load`. Failures are never cached. */
  get(key: string, load: () => Promise<T>): Promise<T>
  clear(): void
  readonly size: number
}

export function createQueryCache<T>(
  options: { ttlMs?: number; maxEntries?: number; clock?: Clock } = {}
): QueryCache<T> {
  const { ttlMs = 10 * 60_000, maxEntries = 60, clock = realClock } = options
  const entries = new Map<string, { at: number; value: Promise<T> }>()
  return {
    get(key, load) {
      const hit = entries.get(key)
      if (hit && clock.now() - hit.at < ttlMs) return hit.value
      entries.delete(key)
      const value = load()
      entries.set(key, { at: clock.now(), value })
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key)
      })
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string)
      return value
    },
    clear: () => entries.clear(),
    get size() {
      return entries.size
    }
  }
}

const cacheKey = (id: string, p: ImageSearchParams): string =>
  JSON.stringify([
    id,
    p.query.trim().toLowerCase(),
    p.page,
    p.perPage,
    p.freeOnly,
    [...(p.kinds ?? [])].sort()
  ])

/** Wrap a provider so searches are spaced out and repeated queries are answered from memory. */
export function polite(
  provider: ImageSearchProvider,
  options: { minGapMs?: number; clock?: Clock; cache?: QueryCache<ImageSearchResult> } = {}
): ImageSearchProvider {
  const schedule = createThrottle(options.minGapMs ?? 400, options.clock)
  const cache = options.cache ?? createQueryCache<ImageSearchResult>({ clock: options.clock })
  return {
    ...provider,
    search: (params) =>
      cache.get(cacheKey(provider.id, params), () => schedule(() => provider.search(params)))
  }
}
