/** The live preview of A11 and A13: what the stage draws before "Place it" (same maths as main's `placeAsset`). Pure. */
import { aspectRatioFor } from '@shared/assets/pictureMaker'
import { resolvePlacement, type PlaceTarget } from '@shared/assets/place'
import type { FitMode, ImageSize, PlacedBox } from '@shared/assets/fit'
import type { AssetKind } from '@shared/assets/types'
import type { Slide } from '@shared/deck/types'
import type { RegionDraft } from '../../seams'

export interface StagePreview {
  box: PlacedBox
  /** The picture to draw inside the dashed box. */
  src: string | null
  /** The element the preview stands in for (hidden while "Replace" is on). */
  hideElementId: string | null
  /** The tag on the stage: `leaf_cross_section · fitted to region 1`. */
  tag: string
}

/** The circle as a `PlaceTarget`; `replaceElementId` is the picture under it when "Replace" is ticked. */
export const regionTarget = (
  region: Pick<RegionDraft, 'path' | 'bbox'>,
  replaceElementId: string | null
): PlaceTarget => ({
  kind: 'region',
  path: region.path,
  bbox: region.bbox,
  replaceElementId
})

/** Which size to assume when the source does not say (online results without one, a version not yet saved). */
export function assumedSize(kind: AssetKind | null | undefined): ImageSize {
  const ratio = aspectRatioFor(kind ?? 'picture')
  const [w, h] = ratio.split(':').map(Number) as [number, number]
  return { width: w * 400, height: h * 400 }
}

/** The frame the picture would get, or null when the target is gone from the slide. */
export function previewBox(
  slide: Slide,
  image: ImageSize,
  target: PlaceTarget,
  fit: FitMode
): { box: PlacedBox; replaceElementId: string | null } | null {
  const placement = resolvePlacement(slide, image, target, fit)
  return 'error' in placement ? null : placement
}

/** `leaf_cross_section · fitted to region 1` / `· filling region 1`; spots say "the spot". */
export function previewTag(name: string, fit: FitMode, where: string): string {
  return `${name} · ${fit === 'fit' ? 'fitted to' : 'filling'} ${where}`
}
