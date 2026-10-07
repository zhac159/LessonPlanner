/** The online service for the running app: real providers over `fetch`, or the fixtures in fake mode. */
import { createSearchProviders } from '../../imageProviders'
import type { FetchFn } from '../../imageProviders/types'
import type { ImageTools } from '../thumbs'
import { createFakeSearchProviders, fakeFetch } from './fake'
import { OnlineService, type OnlineAssets } from './service'
import type { OnlineDescribePort, OnlineReviewPort } from './types'
import { slidePlannerUserAgent } from './userAgent'

export * from './service'
export * from './types'
export { WIKIMEDIA_CONTACT, slidePlannerUserAgent } from './userAgent'

export interface AppOnlineOptions {
  assets: OnlineAssets
  tools: ImageTools
  /** `<dataRoot>/modules/assets/online`. */
  dir: string
  /** SLIDE_PLANNER_FAKE_AI=1: fixtures instead of the network. */
  fake?: boolean
  /** The app version for the User-Agent. */
  version?: string
  /** An optional free Pexels key (the key row in Settings); the provider appears only when a getter is given. */
  getPexelsKey?: () => string | undefined
  /** Defaults to the global `fetch` (Node's, in the main process). */
  fetchFn?: FetchFn
  review?: OnlineReviewPort | null
  describe?: OnlineDescribePort | null
  log?: { warn(message: string): void }
}

export function createAppOnlineService(options: AppOnlineOptions): OnlineService {
  const userAgent = slidePlannerUserAgent(options.version)
  const fetchFn: FetchFn = options.fake
    ? fakeFetch
    : (options.fetchFn ?? ((url, init) => fetch(url, init)))
  const providers = options.fake
    ? createFakeSearchProviders()
    : createSearchProviders({ fetchFn, userAgent, getPexelsKey: options.getPexelsKey })
  return new OnlineService({
    providers,
    fetchFn,
    userAgent,
    tools: options.tools,
    assets: options.assets,
    dir: options.dir,
    review: options.review,
    describe: options.describe,
    log: options.log
  })
}

let shared: OnlineService | null = null

/**
 * The running online service, set by the assets module's main when it activates (null before and after), so the
 * deck-builder's `placeAsset` can call `saveResult` for `{ kind: 'online', resultId }` without building a second one.
 */
export const getSharedOnline = (): OnlineService | null => shared
export const setSharedOnline = (next: OnlineService | null): void => {
  shared = next
}
