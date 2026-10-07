/** Ports the online service needs from its neighbours, so each can be built and tested alone. */
import type { AssetFileExt, AssetKind } from '@shared/assets/types'
import type { NewAsset } from '../store'

/** Saving several online pictures goes through the review queue (A2, origin "picked online"): WP2 implements this. */
export interface OnlineReviewPort {
  /** Opens a review batch holding these pictures (names, licences and credits already filled in). */
  addOnlineBatch(candidates: NewAsset[]): Promise<{ batchId: string }>
}

/** What Claude (cheap, vision) proposes for a picture the teacher added without naming it (WP5 `describeAssets`). */
export interface OnlineDescription {
  title: string
  name: string
  kind: AssetKind
  description: string
  tags: string[]
}

export interface OnlineDescribePort {
  /** Null when no description could be made: the service then names the picture from its own title. */
  describe(input: {
    bytes: Uint8Array
    ext: AssetFileExt
    title: string
    query: string
  }): Promise<OnlineDescription | null>
}
