/** A picture maker for SLIDE_PLANNER_FAKE_AI=1 and tests: tiny distinct PNGs, no network. */
import { ok } from '@shared/result'
import { encodeRaster } from '../../../import/assets/png'
import type { MadeImage, PictureMaker } from '../../imageProviders/nanoBanana'

const PALETTE: ReadonlyArray<[number, number, number]> = [
  [255, 196, 61],
  [76, 170, 160],
  [233, 110, 70],
  [92, 120, 210]
]

export function fakePicture(seed: number, side = 64): MadeImage {
  const [r, g, b] = PALETTE[seed % PALETTE.length]!
  const data = new Uint8ClampedArray(side * side * 4)
  for (let i = 0; i < side * side; i++) {
    const edge = i % side < 6 || i % side > side - 7 || i < side * 6 || i > side * (side - 6)
    data.set(edge ? [30, 40, 80, 255] : [r, g, b, 255], i * 4)
  }
  return { bytes: encodeRaster({ width: side, height: side, data }), mime: 'image/png' }
}

export function createFakeMaker(model: string): PictureMaker {
  let made = 0
  return {
    id: 'fake',
    model,
    async makeImages(request) {
      const images = Array.from({ length: Math.max(1, request.count) }, () => fakePicture(made++))
      return ok({ images, failed: 0 })
    }
  }
}
