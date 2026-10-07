/** Test-only helpers for the review queue: real pptx files in a temp folder, a counting fake AI, a ready service. */
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AiService } from '@shared/ai/types'
import type { ReviewView } from '@shared/contracts/assets'
import { createFakeAiService } from '../../../ai/fake'
import { extractAssets, groupFindings, type FoundAsset } from '../../../import/assets'
import { makePptxWithPictures, type PptxSlideSpec } from '../../../import/assets/testFiles'
import { badgeRaster, photoRaster, pngOf } from '../../../import/assets/testRasters'
import type { AssetsService } from '../service'
import { cleanTemp, tempDir, testService } from '../testing'
import { createFileDescribeCache } from './describeCache'
import { ReviewService } from './service'
import type { ReviewServiceDeps } from './types'

export { cleanTemp }

export const LOGO = pngOf(badgeRaster(120))

/** A deck: the same logo on every slide and one different photo per entry of `photos` (a caption under each). */
export async function deckBytes(photos: number[] = [11, 12]): Promise<Uint8Array> {
  const logoAt = { png: LOGO, x: 8.7, y: 0.1, w: 1, h: 1 }
  const slides: PptxSlideSpec[] = photos.map((seed, i) => ({
    pictures: [
      logoAt,
      { png: pngOf(photoRaster(500 + seed, 380, seed)), x: 2, y: 1.2, w: 4, h: 3 }
    ],
    texts: [{ text: `Picture ${i + 1}`, x: 2, y: 4.3, w: 4, h: 0.5 }]
  }))
  return new Uint8Array(await makePptxWithPictures(slides))
}

/** The pictures `groupFindings` finds in a deck, as style learning would hand them over. */
export async function foundIn(name: string, bytes: Uint8Array): Promise<FoundAsset[]> {
  const { images } = await extractAssets({ name, bytes })
  return groupFindings(images).assets
}

export async function writeTemp(
  dir: string,
  name: string,
  bytes: Uint8Array | string
): Promise<string> {
  const path = join(dir, name)
  await writeFile(path, bytes)
  return path
}

export interface Harness {
  dir: string
  assets: AssetsService
  review: ReviewService
  events: ReviewView[]
  /** Sizes of every `describeAssets` call. */
  calls: number[]
  make(over?: Partial<ReviewServiceDeps>): ReviewService
}

/** The fake AI, counting how many pictures each naming call was given. */
export function countingAi(calls: number[], base: AiService = createFakeAiService()): AiService {
  return {
    ...base,
    describeAssets: (input, opts) => {
      calls.push(input.images.length)
      return base.describeAssets(input, opts)
    }
  }
}

export async function harness(over: Partial<ReviewServiceDeps> = {}): Promise<Harness> {
  const dir = await tempDir()
  const assets = testService(join(dir, 'assets'))
  await assets.init()
  const events: ReviewView[] = []
  const calls: number[] = []
  const make = (extra: Partial<ReviewServiceDeps> = {}): ReviewService =>
    new ReviewService({
      dir: join(dir, 'assets'),
      assets,
      ai: countingAi(calls),
      tools: assets.tools,
      cache: createFileDescribeCache(join(dir, 'assets')),
      emit: (view) => events.push(view),
      ...over,
      ...extra
    })
  return { dir, assets, review: make(), events, calls, make }
}

/** Adds a deck (default: a logo and two photos) as one upload and waits until it is read and named. */
export async function upload(h: Harness, bytes?: Uint8Array, name = 'Y8 Cells.pptx') {
  const path = await writeTemp(h.dir, name, bytes ?? (await deckBytes()))
  const result = await h.review.addPaths([path])
  await h.review.idle()
  return result
}
