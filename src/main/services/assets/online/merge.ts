/** Putting the answers of several image libraries on one page, and the message when none answered. */
import { isFreeToUse } from '@shared/assets/credits'
import { fail, type Failure } from '@shared/result'
import { toFailure } from '../../imageProviders/errors'
import type { ImageSearchItem, ImageSearchProvider } from '../../imageProviders/types'
import { licenceOf } from './mapping'

export const PAGE_SIZE = 24
export const BUSY_MESSAGE = 'The image libraries are busy. Try again in a minute.'

export interface Found {
  item: ImageSearchItem
  provider: ImageSearchProvider
}

/** Round-robin over the libraries (so no one fills the page), without repeats, at most one page. */
export function mergeResults(
  lists: ReadonlyArray<{ provider: ImageSearchProvider; items: ImageSearchItem[] }>,
  freeOnly: boolean
): Found[] {
  const seen = new Set<string>()
  const out: Found[] = []
  for (let row = 0; out.length < PAGE_SIZE; row++) {
    let any = false
    for (const { provider, items } of lists) {
      const item = items[row]
      if (!item) continue
      any = true
      const key = item.sourceUrl || item.fullUrl
      if (seen.has(key) || (freeOnly && !isFreeToUse(licenceOf(item.licence)))) continue
      seen.add(key)
      if (out.length < PAGE_SIZE) out.push({ item, provider })
    }
    if (!any) break
  }
  return out
}

/** What to tell her when every library failed: "busy" when they all asked us to slow down. */
export function allFailed(settled: ReadonlyArray<PromiseSettledResult<unknown>>): Failure {
  const failures = settled.flatMap((o) => (o.status === 'rejected' ? [toFailure(o.reason)] : []))
  if (failures.length > 0 && failures.every((f) => f.code === 'rate-limited')) {
    return fail('rate-limited', BUSY_MESSAGE, { retryAfterSeconds: failures[0]!.retryAfterSeconds })
  }
  const first = failures.find((f) => f.code !== 'cancelled') ?? failures[0]
  if (first?.code === 'cancelled') return first
  return fail('network', 'The image libraries did not answer. Check your connection and try again.')
}
