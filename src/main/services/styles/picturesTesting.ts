/** Test-only: fake picture findings, a fake extractor and fake review / library ports for the styles service. */
import { vi } from 'vitest'
import type { AssetChip, ReviewView } from '@shared/contracts/assets'
import type { ExtractedImage, ExtractionResult } from '../../import/assets'
import type { CreateReviewBatchInput } from '../assets/review/ports'
import type { ExtractFn } from './pictures'
import type { PictureAssetsPort, PicturePorts, PictureReviewPort } from './habits'

const NOT_BLURRY = {
  tooSmall: false,
  thin: false,
  lowResolution: false,
  blurry: false,
  blurScore: null,
  fullPage: false,
  unreadable: false
}

/** One picture occurrence; the same `hash` in two files is ONE picture to `groupFindings`. */
export function fakeImage(
  over: Partial<ExtractedImage> & { id: string; fileName: string; hash: string }
): ExtractedImage {
  return {
    sourceKind: 'pdf',
    pageOrSlide: 1,
    origin: 'slide',
    bytes: new Uint8Array([1, 2, 3]),
    mime: 'image/png',
    width: 400,
    height: 300,
    perceptualHash: '',
    detailHash: '',
    colorSignature: '',
    box: { x: 1100, y: 300, w: 640, h: 480 },
    rotation: 0,
    repeatedOn: [over.pageOrSlide ?? 1],
    nearbyText: '',
    slideText: '',
    kindHint: 'other',
    kindReasons: [],
    cardCount: 0,
    quality: { ...NOT_BLURRY },
    maybePupils: false,
    pupilReasons: [],
    ...over
  }
}

/** The school logo in the top-right corner of every page of `fileName`. */
export const logoOn = (fileName: string, pages: number): ExtractedImage[] =>
  Array.from({ length: pages }, (_, i) =>
    fakeImage({
      id: `${fileName}#${i + 1}.logo`,
      fileName,
      hash: 'a'.repeat(64),
      pageOrSlide: i + 1,
      repeatedOn: Array.from({ length: pages }, (_, n) => n + 1),
      box: { x: 1640, y: 30, w: 220, h: 140 },
      kindHint: 'logo',
      altText: 'school logo'
    })
  )

/** A picture used on one page only (a content photo). */
export const photoOn = (fileName: string, page: number): ExtractedImage =>
  fakeImage({
    id: `${fileName}#${page}.photo`,
    fileName,
    hash: `${page}${fileName}`.padEnd(64, 'b').slice(0, 64),
    pageOrSlide: page,
    kindHint: 'photo'
  })

/** An extractor answering from a table keyed by the teacher's file name; a missing name throws like a damaged file. */
export function fakeExtract(
  table: Record<string, { units: number; images: ExtractedImage[] }>
): ExtractFn & { calls: string[] } {
  const calls: string[] = []
  const extract = vi.fn(async (file: { name: string }): Promise<ExtractionResult> => {
    calls.push(file.name)
    const entry = table[file.name]
    if (!entry) throw new Error('damaged')
    return {
      fileName: file.name,
      sourceKind: 'pdf',
      units: entry.units,
      images: entry.images,
      scanned: false,
      warnings: []
    }
  })
  return Object.assign(extract as unknown as ExtractFn, { calls })
}

export interface FakeLibrary {
  /** sha -> asset: what she has kept. */
  saved: Map<string, { id: string; name: string }>
}

export function fakePorts(): {
  ports: PicturePorts
  review: { batches: CreateReviewBatchInput[]; open: boolean; view: ReviewView }
  library: FakeLibrary
} {
  const review = {
    batches: [] as CreateReviewBatchInput[],
    open: true,
    view: {
      batches: [],
      candidates: [],
      found: 0,
      keeping: 0,
      leftOut: 0,
      stillReading: 0
    } as ReviewView
  }
  const library: FakeLibrary = { saved: new Map() }
  const reviewPort: PictureReviewPort = {
    createReviewBatch: async (input) => {
      review.batches.push(input)
      const batchId = input.batchId ?? 'rvb_1'
      review.view = {
        ...review.view,
        batches: review.open
          ? [
              {
                id: batchId,
                origin: input.source,
                startedAt: '2026-10-06T10:00:00.000Z',
                files: [],
                working: false
              }
            ]
          : [],
        candidates: input.candidates.map((c) => ({
          id: `cand_${c.id}`,
          batchId,
          name: c.suggestedName,
          title: c.suggestedName,
          kind: c.kind === 'other' ? 'picture' : c.kind,
          description: '',
          tags: [],
          thumbDataUrl: `data:image/png;base64,${c.id}`,
          width: 1,
          height: 1,
          decks: c.foundIn.length,
          foundIn: [],
          keep: c.keep,
          suggestedKeep: c.keep,
          leftOut: null
        }))
      }
      return { batchId }
    },
    view: () => review.view
  }
  const byId = (id: string) => [...library.saved.values()].find((a) => a.id === id)
  const assets: PictureAssetsPort = {
    findBySha: (sha) => library.saved.get(sha),
    getAsset: byId,
    fromStyle: () => [...library.saved.values()],
    chips: async (refs): Promise<AssetChip[]> =>
      refs.map((r) => ({
        assetId: r.assetId,
        name: byId(r.assetId)?.name ?? r.name,
        kind: 'logo',
        thumbDataUrl: null,
        removed: false
      }))
  }
  return { ports: { review: reviewPort, assets }, review, library }
}
