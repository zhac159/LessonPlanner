/**
 * What one chat turn may do with the library: the catalogue for the prompt, `list_assets` (a local search) and
 * `place_asset` (one ChangeSet through the placer; "region n" is the circle of THIS message, "spot" a picture spot).
 */
import type { AssetFact, ChatAssets, PlaceToolArgs, PlaceToolResult } from '@shared/ai/types'
import { underlyingPicture } from '@shared/assets/fit'
import { matchesAssetQuery } from '@shared/assets/library'
import type { PlaceTarget } from '@shared/assets/place'
import type { Asset } from '@shared/assets/types'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import type { Deck } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { buildAssetCatalogue, factOf, habitsOf, mostUsedFirst } from '../../ai/prompts/assets'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import type { AssetPlacer, Placed } from './placer'

const LIST_LIMIT = 30
const DEFAULT_WIDTH = 240

export interface TurnAssetsInput {
  assets: LessonAssetsPort
  placer: AssetPlacer
  style: StyleProfile | null
  lessonId: string
  /** The circles of this message. */
  regions: readonly RegionDraft[]
  /** The deck as it is now (the turn keeps it current). */
  deck: () => Deck
  /** Called after every placement that was applied, so the turn can record and announce it. */
  onPlaced(placed: Placed): void
}

const bare = (name: string): string =>
  name
    .trim()
    .replace(/^\{\{|\}\}$/g, '')
    .trim()

/** The width the style gives this asset on this kind of slide (its placement rule), else 240. */
function ruleWidth(style: StyleProfile | null, asset: Asset, deck: Deck, slideId: string): number {
  const kind = deck.slides.find((s) => s.id === slideId)?.kind
  const rules = habitsOf(style)?.placements.filter((r) => r.assetId === asset.id) ?? []
  const rule = rules.find((r) => r.slideKind === kind) ?? rules.find((r) => r.slideKind === 'every')
  return rule?.widthUnits ?? DEFAULT_WIDTH
}

/** Where `place_asset` means; a message explains what is missing or wrong. */
function targetOf(
  args: PlaceToolArgs,
  input: TurnAssetsInput,
  asset: Asset
): PlaceTarget | { error: string } {
  if (args.spot) return { kind: 'spot', elementId: args.spot }
  if (args.region > 0) {
    const region = input.regions.find((r) => r.n === args.region)
    if (!region) return { error: `There is no circled region ${args.region} in this message.` }
    const slide = input.deck().slides.find((s) => s.id === region.slideId)
    const under =
      args.replaceUnder && slide ? underlyingPicture(slide, { path: region.path }) : undefined
    return {
      kind: 'region',
      path: region.path,
      bbox: region.bbox,
      replaceElementId: under?.id ?? null
    }
  }
  if (args.boxW > 0 && args.boxH > 0) {
    return { kind: 'box', box: { x: args.boxX, y: args.boxY, w: args.boxW, h: args.boxH } }
  }
  if (args.anchor !== 'none') {
    const widthUnits =
      args.widthUnits > 0
        ? args.widthUnits
        : ruleWidth(input.style, asset, input.deck(), args.slideId)
    return { kind: 'anchor', anchor: args.anchor, widthUnits }
  }
  return { error: 'Say where it goes: an anchor, a box, a region number or a picture spot.' }
}

export function chatAssetsFor(input: TurnAssetsInput): ChatAssets {
  const { assets, placer } = input
  return {
    catalogue: buildAssetCatalogue(assets.list(), habitsOf(input.style), { canSearch: true }),
    list({ query, kind }): AssetFact[] {
      const wanted = kind === 'any' || !kind ? undefined : kind
      return mostUsedFirst(
        assets.list().filter((a) => (!wanted || a.kind === wanted) && matchesAssetQuery(a, query))
      )
        .slice(0, LIST_LIMIT)
        .map(factOf)
    },
    async place(args): Promise<PlaceToolResult> {
      const name = bare(args.asset).toLowerCase()
      const asset = assets.list().find((a) => a.name.toLowerCase() === name)
      if (!asset) return { ok: false, error: `No asset called ${bare(args.asset)}.` }
      const target = targetOf(args, input, asset)
      if ('error' in target) return { ok: false, error: target.error }
      const done = await placer.place({
        lessonId: input.lessonId,
        slideId: args.slideId,
        asset,
        target,
        fit: args.fit,
        by: 'ai'
      })
      if (!done.ok) return { ok: false, error: done.message }
      input.onPlaced(done)
      const { x, y, w, h } = done.placed
      return {
        ok: true,
        changeSet: done.changeSet,
        elementId: done.elementId,
        placed: { x, y, w, h }
      }
    }
  }
}
