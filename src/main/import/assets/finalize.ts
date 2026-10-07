/**
 * Shared by the pptx and pdf readers: turns raw pictures (bytes + placement) into ExtractedImage records.
 * Phase 1 `prepareImage` analyses one bitmap (cached per source object, so a logo on 18 pages is analysed once);
 * phase 2 `finalise` needs all occurrences (repeats, duplicates, kind hints) and runs once per file.
 */
import { analyse, sha256, type Analysis } from './analysis'
import { detectCards } from './cards'
import { guessPupils, kindOf, qualityOf } from './classify'
import { headerSize } from './decode'
import { sameBitmap, samePlaceAndLook } from './identity'
import type {
  Box,
  CropRect,
  ExtractedImage,
  ImageDecoder,
  ImageMime,
  ImageOrigin,
  Raster
} from './types'

export interface Facts {
  analysis: Analysis | null
  cardCount: number
  singleCard: boolean
}

/** One analysed bitmap, shared by every place it is shown. */
export interface Prepared {
  bytes: Uint8Array
  mime: ImageMime
  width: number
  height: number
  hash: string
  perceptualHash: string
  detailHash: string
  colorSignature: string
  facts: Facts
}

export interface Placement {
  pageOrSlide: number
  origin: ImageOrigin
  box: Box
  rotation: number
  crop?: CropRect
  nearbyText: string
  slideText: string
  altText?: string
  /** Slides that show this picture besides `pageOrSlide` (layout and master pictures). */
  usedOn?: number[]
}

export interface Draft {
  id: string
  prepared: Prepared
  placement: Placement
}

/** Analyses a bitmap. `raster` is used when the caller already has the pixels, else `bytes` is decoded. */
export async function prepareImage(
  bytes: Uint8Array,
  mime: ImageMime,
  options: { raster?: Raster | null; decode: ImageDecoder; maxPixels: number }
): Promise<Prepared> {
  const hash = sha256(bytes)
  const header = headerSize(bytes, mime)
  let raster = options.raster
  if (raster === undefined) {
    const tooBig = header !== null && header.width * header.height > options.maxPixels
    raster = tooBig ? null : await options.decode(bytes, mime)
  }
  if (!raster) {
    return {
      bytes,
      mime,
      width: header?.width ?? 0,
      height: header?.height ?? 0,
      hash,
      perceptualHash: '',
      detailHash: '',
      colorSignature: '',
      facts: { analysis: null, cardCount: 0, singleCard: false }
    }
  }
  const analysis = analyse(raster)
  let cardCount = 0
  let singleCard = false
  // Card detection only makes sense on a plain background and is the costliest check, so gate it.
  if (
    (analysis.edgePlainShare >= 0.6 || analysis.whiteFraction >= 0.25) &&
    raster.width >= 60 &&
    raster.height >= 40
  ) {
    const found = detectCards(raster)
    cardCount = found.regions.length >= 2 ? found.regions.length : 0
    if (found.regions.length === 1) {
      const r = found.regions[0]
      const share = ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)) / (found.work.w * found.work.h)
      singleCard = share >= 0.85 && analysis.edgePlainShare >= 0.9 && analysis.colorBins >= 6
    }
  }
  return {
    bytes,
    mime,
    width: raster.width,
    height: raster.height,
    hash,
    perceptualHash: analysis.perceptualHash,
    detailHash: analysis.detailHash,
    colorSignature: analysis.colorSignature,
    facts: { analysis, cardCount, singleCard }
  }
}

/** The same picture again: identical or re-saved bytes, or the same place and look on another slide. */
function sameOccurrence(a: Draft, b: Draft): boolean {
  return (
    sameBitmap(a.prepared, b.prepared) ||
    samePlaceAndLook(
      { ...a.prepared, box: a.placement.box },
      { ...b.prepared, box: b.placement.box }
    )
  )
}

/** Phase 2: repeats, exact duplicates, quality flags, kind and pupil guess for every occurrence. */
export function finalise(
  drafts: Draft[],
  meta: { fileName: string; sourceKind: 'pptx' | 'pdf'; units: number }
): ExtractedImage[] {
  // Identity classes, so a re-saved copy of the logo still counts as "the same picture on another slide".
  const classOf = drafts.map((_, i) => i)
  const find = (i: number): number => (classOf[i] === i ? i : (classOf[i] = find(classOf[i])))
  const byHash = new Map<string, number>()
  drafts.forEach((draft, i) => {
    const seen = byHash.get(draft.prepared.hash)
    if (seen === undefined) byHash.set(draft.prepared.hash, i)
    else classOf[find(i)] = find(seen)
  })
  const reps = [...new Set(drafts.map((_, i) => find(i)))]
  for (let a = 0; a < reps.length; a++) {
    for (let b = a + 1; b < reps.length; b++) {
      if (find(reps[a]) !== find(reps[b]) && sameOccurrence(drafts[reps[a]], drafts[reps[b]]))
        classOf[find(reps[b])] = find(reps[a])
    }
  }
  const pages = new Map<number, Set<number>>()
  drafts.forEach((draft, i) => {
    const set = pages.get(find(i)) ?? new Set<number>()
    set.add(draft.placement.pageOrSlide)
    for (const slide of draft.placement.usedOn ?? []) set.add(slide)
    pages.set(find(i), set)
  })

  const firstByHash = new Map<string, string>()
  return drafts.map((draft, i): ExtractedImage => {
    const { prepared: p, placement } = draft
    const repeatedOn = [...(pages.get(find(i)) ?? [])].sort((a, b) => a - b)
    const { analysis, cardCount, singleCard } = p.facts
    const quality = qualityOf({
      width: p.width,
      height: p.height,
      box: placement.box,
      analysis,
      origin: placement.origin
    })
    const { kind, reasons } = kindOf({
      width: p.width,
      height: p.height,
      box: placement.box,
      origin: placement.origin,
      repeatedOn,
      units: meta.units,
      analysis,
      cardCount,
      singleCard,
      altText: placement.altText,
      nearbyText: placement.nearbyText,
      isJpeg: p.mime === 'image/jpeg'
    })
    const pupils = guessPupils({
      kind,
      width: p.width,
      height: p.height,
      nearbyText: placement.nearbyText,
      slideText: placement.slideText,
      altText: placement.altText,
      skinFraction: analysis?.skinFraction ?? 0
    })
    const earlier = firstByHash.get(p.hash)
    if (!earlier) firstByHash.set(p.hash, draft.id)
    return {
      id: draft.id,
      fileName: meta.fileName,
      sourceKind: meta.sourceKind,
      pageOrSlide: placement.pageOrSlide,
      origin: placement.origin,
      bytes: p.bytes,
      mime: p.mime,
      width: p.width,
      height: p.height,
      hash: p.hash,
      perceptualHash: p.perceptualHash,
      detailHash: p.detailHash,
      colorSignature: p.colorSignature,
      box: placement.box,
      rotation: placement.rotation,
      crop: placement.crop,
      repeatedOn,
      nearbyText: placement.nearbyText,
      slideText: placement.slideText,
      altText: placement.altText,
      kindHint: kind,
      kindReasons: reasons,
      cardCount,
      quality,
      maybePupils: pupils.maybePupils,
      pupilReasons: pupils.reasons,
      duplicateOf: earlier
    }
  })
}
