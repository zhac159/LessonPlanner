/**
 * What the review queue keeps on disk (`review/<batchId>/batch.json`) and what it needs from its neighbours
 * (agents/ASSETS.md §2.7, §3.2). Pure types; the contract's view types live in `@shared/contracts/assets`.
 */
import type { AiService, AssetKindHint } from '@shared/ai/types'
import type {
  Asset,
  AssetCredit,
  AssetFileExt,
  AssetFoundIn,
  AssetKind,
  AssetLicence,
  AssetSource
} from '@shared/assets/types'
import type {
  AssetSummary,
  LeftOutReason,
  ReviewFile,
  ReviewOrigin,
  ReviewView
} from '@shared/contracts/assets'
import type { DescribeCache } from '../../../ai/calls/pictures'
import type { extractAssets } from '../../../import/assets'
import type { ImageTools } from '../imageTools'
import type { NewAsset } from '../storeParts'

export const REVIEW_SCHEMA_VERSION = 1
/** At most this many candidates per batch; the rest are repeats and small variations (agents/ASSETS.md §5.1). */
export const MAX_CANDIDATES = 60
/** An unreviewed batch is kept this long (agents/ASSETS.md §2.7). */
export const KEEP_BATCH_MS = 30 * 24 * 60 * 60 * 1000
/** Pictures per naming call (the AI call batches by 12 as well). */
export const DESCRIBE_CHUNK = 12
/** Thumbnails sent to Claude: at most this many pixels on the long side. */
export const DESCRIBE_SIDE = 512

export type EditableField = 'name' | 'title' | 'kind' | 'description'

/** One picture waiting for her OK, as stored (the bytes are in `<id><ext>` next to `batch.json`). */
export interface StoredCandidate {
  id: string
  /** The `ReviewFile` it was found in ('' for pictures picked online). */
  fileId: string
  /** `FoundAsset.id` it came from (links "older version of" between candidates); '' when not from the extractor. */
  foundId: string
  /** Occurrence ids merged into it: later groupings of the same batch are matched with these. */
  occurrences: string[]
  name: string
  title: string
  kind: AssetKind
  description: string
  tags: string[]
  ext: AssetFileExt
  width: number
  height: number
  bytes: number
  sha256: string
  keep: boolean
  /** What the checkbox is proposed as, so a later regrouping does not undo her own tick. */
  suggestedKeep: boolean
  /** The extraction service's reason for leaving it out (`duplicate` is worked out against the library). */
  extractorReason: Exclude<LeftOutReason, 'duplicate'> | null
  /** Name of the library asset with the same bytes, when there is one. */
  duplicateOf: string | null
  /** Candidate id of a better copy (the extractor's or Claude's finding). */
  olderOf: string | null
  /** Claude saw people who could be children. */
  claudePupils: boolean
  hint: AssetKindHint
  nearbyText: string
  fileNames: string[]
  /** Claude (or the cache) has described it. False shows the extractor's name: "Not named yet". */
  named: boolean
  /** Fields she changed by hand: a later description never overwrites them. */
  edited: EditableField[]
  foundIn: AssetFoundIn[]
  source: AssetSource
  licence: AssetLicence
  credit: AssetCredit | null
  /** True when a taken name may be replaced by the next free one when it is saved. */
  autoName: boolean
}

export interface StoredBatch {
  schemaVersion: typeof REVIEW_SCHEMA_VERSION
  id: string
  origin: ReviewOrigin
  startedAt: string
  files: ReviewFile[]
  working: boolean
  candidates: StoredCandidate[]
  /** Occurrence ids of pictures already saved from this batch: a later grouping does not offer them again. */
  handled?: string[]
}

/** The part of the assets service the review queue uses. */
export interface ReviewAssetsPort {
  takenNames(): string[]
  findBySha(sha: string): Asset | undefined
  add(input: NewAsset): Promise<Asset>
  summary(asset: Asset): Promise<AssetSummary>
}

export interface ReviewServiceDeps {
  /** `<dataRoot>/modules/assets`: batches live in `review/`. */
  dir: string
  assets: ReviewAssetsPort
  ai: Pick<AiService, 'describeAssets'>
  tools: ImageTools
  /** `describe-cache.json`: a picture is described once, ever. */
  cache: DescribeCache
  /** Pushes `review:changed` (the module wires `ctx.emit`). */
  emit(view: ReviewView): void
  now?: () => Date
  newId?: (prefix: string) => string
  /** Test seam: the extraction service. */
  extract?: typeof extractAssets
  log?: { warn(message: string): void }
}
