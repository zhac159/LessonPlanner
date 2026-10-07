/**
 * Picture habits and the A6 view data (agents/ASSETS.md §3.6, §5.3). The habits are built LOCALLY from the stored facts of
 * every learned file and the assets she kept (`buildPictureHabits`, no Claude call); the lines shown in "Picture habits" are
 * written from the placement rules with each asset's CURRENT name, so a rename or a delete never leaves a stale sentence.
 */
import {
  buildPictureHabits,
  placementLine,
  type KeptAsset,
  type PictureFact,
  type SlideFact
} from '@shared/assets/habits'
import type { AssetChip, ReviewView } from '@shared/contracts/assets'
import type { PictureHabits } from '@shared/assets/types'
import type { CreateReviewBatchInput } from '../assets/review/ports'
import type { StyleStore } from './store'
import type { PicturesMeta, StyleState } from './types'

/** What the style needs from the review queue (`ReviewService` fits). */
export interface PictureReviewPort {
  createReviewBatch(input: CreateReviewBatchInput): Promise<{ batchId: string }>
  view(): ReviewView
}

/** What the style needs from the library (an adapter over `AssetsService`). */
export interface PictureAssetsPort {
  findBySha(sha: string): { id: string; name: string } | undefined
  getAsset(assetId: string): { id: string; name: string } | undefined
  /** Library assets cut out of this style's files. */
  fromStyle(styleId: string): Array<{ id: string; name: string }>
  chips(refs: ReadonlyArray<{ assetId: string; name: string }>): Promise<AssetChip[]>
}

export interface PicturePorts {
  review: PictureReviewPort | null
  assets: PictureAssetsPort | null
}

export const NO_PORTS: PicturePorts = { review: null, assets: null }

const PREVIEW_COUNT = 6

/** The facts of every learned file, in queue order. Files without stored facts (not yet looked at) are skipped. */
export async function learnedFacts(
  store: StyleStore,
  state: StyleState
): Promise<{ slides: SlideFact[]; pictures: PictureFact[]; files: number }> {
  const slides: SlideFact[] = []
  const pictures: PictureFact[] = []
  let files = 0
  for (const source of state.profile.sources) {
    if (source.status !== 'learned') continue
    const facts = await store.readPictures(state.profile.id, source.id)
    if (!facts) continue
    files++
    slides.push(...facts.slides)
    pictures.push(...facts.pictures)
  }
  return { slides, pictures, files }
}

/** The kept assets: groups whose picture is saved in the library (matched by the bytes' hash). */
export function keptAssets(
  meta: PicturesMeta | undefined,
  assets: PictureAssetsPort | null
): KeptAsset[] {
  if (!meta || !assets) return []
  return Object.entries(meta.keys).flatMap(([assetKey, { sha }]) => {
    const asset = assets.findBySha(sha)
    return asset ? [{ assetKey, assetId: asset.id }] : []
  })
}

const signature = (kept: readonly KeptAsset[]): string[] =>
  kept.map((k) => `${k.assetKey}:${k.assetId}`).sort()

/**
 * Rebuilds the habits from the stored facts. Returns `undefined` when nothing has been looked at yet (the profile keeps what
 * it has), else the new habits (`undefined` too when she has no pictures at all) and the signature of the kept assets they were built for.
 */
export async function computeHabits(
  store: StyleStore,
  state: StyleState,
  ports: PicturePorts
): Promise<{ habits: PictureHabits | undefined; kept: string[] } | undefined> {
  const facts = await learnedFacts(store, state)
  if (facts.files === 0) return undefined
  const kept = keptAssets(state.meta.pictures, ports.assets)
  // no picture anywhere: the profile carries no habits at all (A6 says "No pictures found in these files.")
  const habits =
    facts.pictures.length === 0
      ? undefined
      : buildPictureHabits({ slides: facts.slides, pictures: facts.pictures, assets: kept })
  return { habits, kept: signature(kept) }
}

/** Do the habits in the profile still match the assets she has kept? (Cheap: no facts are read.) */
export function keptChanged(state: StyleState, ports: PicturePorts): boolean {
  const meta = state.meta.pictures
  if (!meta || !ports.assets) return false
  return signature(keptAssets(meta, ports.assets)).join('|') !== meta.kept.join('|')
}

/** The "Picture habits" lines: general lines first, then one chip line per rule with the asset's current name. */
export function habitLines(
  habits: PictureHabits | undefined,
  assets: PictureAssetsPort | null
): string[] {
  if (!habits) return []
  const rules = habits.placements.flatMap((rule) => {
    const name = assets?.getAsset(rule.assetId)?.name
    return name ? [placementLine(rule, name)] : []
  })
  return [...habits.lines, ...rules]
}

async function previewChips(
  state: StyleState,
  meta: PicturesMeta,
  ports: PicturePorts
): Promise<AssetChip[]> {
  const batch = meta.batchId
    ? ports.review?.view().candidates.filter((c) => c.batchId === meta.batchId)
    : []
  if (batch && batch.length > 0) {
    return [...batch]
      .sort((a, b) => Number(b.keep) - Number(a.keep))
      .slice(0, PREVIEW_COUNT)
      .map((c) => ({
        assetId: c.id,
        name: c.name,
        kind: c.kind,
        thumbDataUrl: c.thumbDataUrl,
        removed: false
      }))
  }
  const saved = ports.assets?.fromStyle(state.profile.id).slice(0, PREVIEW_COUNT) ?? []
  return ports.assets ? ports.assets.chips(saved.map((a) => ({ assetId: a.id, name: a.name }))) : []
}

/** What the A6 cards show. `found: null` until the pictures have been looked at. */
export async function pictureView(
  state: StyleState,
  ports: PicturePorts
): Promise<NonNullable<StyleState['pictureView']>> {
  const lines = habitLines(state.profile.pictures, ports.assets)
  const meta = state.meta.pictures
  if (!meta) return { lines, found: null }
  const keys = Object.values(meta.keys)
  const open = meta.batchId
    ? (ports.review?.view().batches.some((b) => b.id === meta.batchId) ?? false)
    : false
  const saved = ports.assets?.fromStyle(state.profile.id).length ?? 0
  return {
    lines,
    found: {
      found: keys.length,
      suggested: keys.filter((k) => k.keep).length,
      saved,
      batchId: open ? meta.batchId : null,
      preview: keys.length > 0 ? await previewChips(state, meta, ports) : []
    }
  }
}

/** The view data from what is stored, for the moments the ports cannot be asked (progress events). */
export const storedPictureView = (state: StyleState): NonNullable<StyleState['pictureView']> =>
  state.pictureView ?? {
    lines: state.profile.pictures?.lines ?? [],
    found: state.meta.pictures
      ? {
          found: Object.keys(state.meta.pictures.keys).length,
          suggested: Object.values(state.meta.pictures.keys).filter((k) => k.keep).length,
          saved: 0,
          batchId: null,
          preview: []
        }
      : null
  }
