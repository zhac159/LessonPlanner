/** The review queue for the running app: batches in `<assets dir>/review`, descriptions cached in `describe-cache.json`. */
import type { AiService } from '@shared/ai/types'
import type { ReviewView } from '@shared/contracts/assets'
import type { AssetsService } from '../service'
import { createFileDescribeCache, type FileDescribeCache } from './describeCache'
import { ReviewService } from './service'

export * from './ports'
export { createFileDescribeCache, type FileDescribeCache } from './describeCache'
export { ReviewService } from './service'
export type { ReviewAssetsPort, ReviewServiceDeps } from './types'

export interface AppReviewOptions {
  assets: AssetsService
  ai: Pick<AiService, 'describeAssets'>
  /** `<dataRoot>/modules/assets`. */
  dir: string
  emit(view: ReviewView): void
  cache?: FileDescribeCache
  log?: { warn(message: string): void }
}

export function createAppReviewService(options: AppReviewOptions): ReviewService {
  const { assets } = options
  return new ReviewService({
    dir: options.dir,
    assets: {
      takenNames: () => assets.takenNames(),
      findBySha: (sha) => assets.findBySha(sha),
      add: (input) => assets.add(input),
      summary: (asset) => assets.summary(asset)
    },
    ai: options.ai,
    tools: assets.tools,
    cache: options.cache ?? createFileDescribeCache(options.dir),
    emit: options.emit,
    log: options.log
  })
}

let shared: ReviewService | null = null

/**
 * The running review queue, set by the assets module's main when it activates (null before and after), so style
 * learning (WP6) can call `getSharedReview()?.createReviewBatch(...)` without building a second queue.
 */
export const getSharedReview = (): ReviewService | null => shared
export const setSharedReview = (next: ReviewService | null): void => {
  shared = next
}
