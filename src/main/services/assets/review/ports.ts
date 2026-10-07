/**
 * The ports other work packages call to put pictures into the review queue (agents/ASSETS.md §5.1, §3.2):
 *  - style learning (WP6) calls `createReviewBatch` with the pictures `groupFindings` found in a style's files;
 *  - the online service (`OnlineReviewPort`, ../online/types.ts) hands over several picked pictures.
 * Both are implemented by `ReviewService` (./service); callers depend on these types only.
 */
import type { ReviewOrigin } from '@shared/contracts/assets'
import type { FoundAsset } from '../../../import/assets'

export interface ReviewBatchFile {
  /** The deck's name as the teacher knows it ("Y8 Photosynthesis.pptx"); matches `FoundAsset.foundIn[].fileName`. */
  name: string
  /** The `SourceRef.id` inside the style (for `Asset.foundIn`); defaults to the file name. */
  sourceId?: string
}

export interface CreateReviewBatchInput {
  /** Where the pictures came from; "WHILE LEARNING {STYLE NAME}" for `{ kind: 'style', … }`. */
  source: ReviewOrigin
  /** Pictures merged by `groupFindings` over the decks that were read (their bytes are in `image.bytes`). */
  candidates: FoundAsset[]
  /** The decks that were read ("Where I looked"); defaults to the file names found in `candidates`. */
  files?: ReviewBatchFile[]
  /** Add to this open batch instead of starting a new one (pictures already there are merged, not repeated). */
  batchId?: string
}

/** What style learning needs from the review queue. */
export interface ReviewBatchPort {
  /**
   * Saves the pictures into a review batch on disk and returns at once; naming and describing them (Claude,
   * ~$0.025 per 12 pictures) carries on in the background and `review:changed` events report it.
   */
  createReviewBatch(input: CreateReviewBatchInput): Promise<{ batchId: string }>
}
