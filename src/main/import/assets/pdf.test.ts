import { describe, expect, it } from 'vitest'
import { ImportError } from '../errors'
import { makePdf } from '../testing'
import { extractAssets, groupFindings } from '.'
import { decodePng } from './png'
import { makePdfWithImages, rgbBytes, type PdfImageSpec, type PdfPageSpec } from './testFiles'
import { SAMPLE_JPEG } from './testJpeg'
import { badgeRaster, cardSheet, makeRaster, photoRaster } from './testRasters'

const rgbImage = (raster = photoRaster(60, 40, 2)): PdfImageSpec => ({
  kind: 'rgb',
  width: raster.width,
  height: raster.height,
  data: rgbBytes(raster.data)
})

const run = (images: PdfImageSpec[], pages: PdfPageSpec[], options = {}) =>
  extractAssets(
    { name: 'Deck.pdf', bytes: new Uint8Array(makePdfWithImages(images, pages)) },
    options
  )

const place = (image = 0, x = 72, y = 200, w = 144, h = 72) => ({ image, x, y, w, h })

describe('extractAssets: pdf', () => {
  it('maps a placed picture to the 1920x1080 grid and returns it as a lossless PNG', async () => {
    const raster = photoRaster(60, 40, 2)
    const { images, units, sourceKind } = await run([rgbImage(raster)], [{ placements: [place()] }])
    expect(sourceKind).toBe('pdf')
    expect(units).toBe(1)
    expect(images).toHaveLength(1)
    const [image] = images
    expect(image.mime).toBe('image/png')
    expect(image.width).toBe(60)
    expect(image.height).toBe(40)
    expect(image.pageOrSlide).toBe(1)
    // 720 x 405 pt page: x 72 -> 192, width 144 -> 384; PDF y is from the bottom: top = 405 - 272 = 133 pt
    expect(image.box).toEqual({ x: 192, y: 355, w: 384, h: 192 })
    expect(image.rotation).toBe(0)
    expect(Array.from(decodePng(image.bytes).data)).toEqual(Array.from(raster.data))
  })

  it('saves JPEG pictures byte for byte without re-encoding', async () => {
    const { images } = await run(
      [{ kind: 'jpeg', width: 64, height: 48, data: SAMPLE_JPEG }],
      [{ placements: [place(0, 100, 100, 256, 192)] }]
    )
    expect(images[0].mime).toBe('image/jpeg')
    expect(Buffer.from(images[0].bytes).equals(Buffer.from(SAMPLE_JPEG))).toBe(true)
    expect(images[0].width).toBe(64)
    // pixels were still analysed (from pdf.js's decode)
    expect(images[0].perceptualHash).toHaveLength(16)
  })

  it('applies the soft mask as the alpha channel', async () => {
    const raster = photoRaster(4, 4, 3)
    const smask = Uint8Array.from({ length: 16 }, (_, i) => i * 16)
    const image: PdfImageSpec = { ...rgbImage(raster), smask }
    const { images } = await run([image], [{ placements: [place(0, 100, 100, 80, 80)] }])
    const decoded = decodePng(images[0].bytes)
    expect(images[0].mime).toBe('image/png')
    expect(Array.from(decoded.data.filter((_, i) => i % 4 === 3))).toEqual(Array.from(smask))
    expect(decoded.data[0]).toBe(raster.data[0])
  })

  it('does not pass a JPEG through when it has a soft mask', async () => {
    const image: PdfImageSpec = {
      kind: 'jpeg',
      width: 64,
      height: 48,
      data: SAMPLE_JPEG,
      smask: new Uint8Array(64 * 48).fill(200)
    }
    const { images } = await run([image], [{ placements: [place(0, 100, 100, 128, 96)] }])
    expect(images[0].mime).toBe('image/png')
    expect(decodePng(images[0].bytes).data[3]).toBe(200)
  })

  it('converts gray, CMYK, indexed and stencil-mask pictures', async () => {
    const gray: PdfImageSpec = {
      kind: 'gray',
      width: 2,
      height: 1,
      data: Uint8Array.from([0, 200])
    }
    const cmyk: PdfImageSpec = {
      kind: 'cmyk',
      width: 2,
      height: 1,
      data: Uint8Array.from([0, 0, 0, 0, 255, 0, 0, 0])
    }
    const indexed: PdfImageSpec = {
      kind: 'indexed',
      width: 2,
      height: 1,
      data: Uint8Array.from([0, 1]),
      palette: Uint8Array.from([255, 0, 0, 0, 0, 255])
    }
    const mask: PdfImageSpec = {
      kind: 'mask',
      width: 8,
      height: 2,
      data: Uint8Array.from([0b11110000, 0b00001111])
    }
    const spots = [0, 1, 2, 3].map((i) => place(i, 50 + i * 150, 150, 100, 50))
    const { images, warnings } = await run([gray, cmyk, indexed, mask], [{ placements: spots }])
    expect(warnings).toEqual([])
    expect(images).toHaveLength(4)
    const px = (n: number, p: number) =>
      Array.from(decodePng(images[n].bytes).data.slice(p * 4, p * 4 + 4))
    expect(px(0, 0).slice(0, 3)).toEqual([0, 0, 0])
    expect(px(0, 1).slice(0, 3)).toEqual([200, 200, 200])
    expect(px(1, 0).slice(0, 3)).toEqual([255, 255, 255])
    expect(px(1, 1)[0]).toBeLessThan(80) // cyan has little red
    expect(px(1, 1)[2]).toBeGreaterThan(180)
    expect(px(2, 0)).toEqual([255, 0, 0, 255])
    expect(px(2, 1)).toEqual([0, 0, 255, 255])
    const stencil = decodePng(images[3].bytes).data.filter((_, i) => i % 4 === 3)
    expect(new Set(stencil)).toEqual(new Set([0, 255])) // some painted, some clear
  })

  it('records rotation and a rectangular clip as crop', async () => {
    const rotated = await run(
      [rgbImage()],
      [{ placements: [{ ...place(0, 300, 100, 100, 50), rotate: 90 }] }]
    )
    expect(rotated.images[0].rotation).toBe(270) // a quarter turn anticlockwise = 270 clockwise
    expect(rotated.images[0].box.w).toBeCloseTo(50 * 2.6667, -1)
    expect(rotated.images[0].box.h).toBeCloseTo(100 * 2.6667, -1)

    const clipped = await run(
      [rgbImage()],
      [{ placements: [{ ...place(0, 100, 100, 200, 100), clip: [100, 100, 100, 100] }] }]
    )
    const [image] = clipped.images
    expect(image.crop?.l).toBeCloseTo(0, 2)
    expect(image.crop?.r).toBeCloseTo(0.5, 2)
    expect(image.box.w).toBeCloseTo(100 * 2.6667, -1)
    expect(image.width).toBe(60) // the stored bitmap is still the whole picture
  })

  it('drops pictures that are completely outside the page or clipped away', async () => {
    const { images } = await run(
      [rgbImage()],
      [
        {
          placements: [
            place(0, 900, 100, 100, 50),
            { ...place(0, 100, 100, 100, 50), clip: [400, 300, 50, 50] },
            place(0, 100, 100, 100, 50)
          ]
        }
      ]
    )
    expect(images).toHaveLength(1)
  })

  it('finds a picture repeated on several pages and merges it into one asset', async () => {
    const logo = rgbImage(badgeRaster(80, [20, 40, 110], false))
    const photo = rgbImage(photoRaster(300, 200, 5))
    const pages: PdfPageSpec[] = [
      { placements: [place(0, 600, 330, 100, 60)] },
      { placements: [place(0, 600, 330, 100, 60), place(1, 100, 100, 400, 250)] },
      { placements: [place(0, 600, 330, 100, 60)] },
      { placements: [place(0, 600, 330, 100, 60)] }
    ]
    const { images } = await run([logo, photo], pages)
    expect(images).toHaveLength(5)
    const logos = images.filter((i) => i.width === 80)
    expect(logos.every((i) => i.repeatedOn.join() === '1,2,3,4')).toBe(true)
    expect(logos.every((i) => i.kindHint === 'logo')).toBe(true)
    expect(logos[1].duplicateOf).toBe(logos[0].id)
    const findings = groupFindings(images)
    expect(findings.found).toBe(2)
    expect(findings.assets.find((a) => a.kind === 'logo')?.foundOn).toBe(4)
  })

  it('reads the label under a picture', async () => {
    const { images } = await run(
      [rgbImage()],
      [
        {
          texts: [
            { text: 'wolf', x: 100, y: 180 },
            { text: 'Page title', x: 40, y: 380 }
          ],
          placements: [place()]
        }
      ]
    )
    expect(images[0].nearbyText).toBe('wolf')
    expect(images[0].slideText).toContain('Page title')
  })

  it('ignores specks and lines, and a full-page scan is not an asset', async () => {
    const speck = rgbImage(photoRaster(20, 20, 1))
    const line: PdfImageSpec = {
      kind: 'gray',
      width: 400,
      height: 2,
      data: new Uint8Array(800).fill(90)
    }
    const full = rgbImage(photoRaster(80, 45, 4))
    const { images, scanned } = await run(
      [speck, line, full],
      [
        {
          texts: [{ text: 'A page that also has plenty of text on it', x: 50, y: 50 }],
          placements: [
            place(0, 10, 10, 15, 15),
            place(1, 100, 300, 400, 2),
            place(2, 0, 0, 720, 405)
          ]
        }
      ]
    )
    expect(scanned).toBe(false)
    expect(images.find((i) => i.width === 20)?.quality.tooSmall).toBe(true)
    expect(images.find((i) => i.width === 400)?.quality.thin).toBe(true)
    expect(images.find((i) => i.width === 80)?.quality.fullPage).toBe(true)
    const findings = groupFindings(images)
    expect(findings.found).toBe(0)
    expect(findings.ignored).toEqual({ tooSmall: 1, thin: 1, fullPage: 1 })
  })

  it('recognises a scanned PDF: only full-page pictures, no text', async () => {
    const page = (seed: number) => rgbImage(photoRaster(80, 45, seed))
    const scan = await run(
      [page(1), page(2), page(3)],
      [0, 1, 2].map((i) => ({ placements: [place(i, 0, 0, 720, 405)] }))
    )
    expect(scan.scanned).toBe(true)
    expect(groupFindings(scan.images).found).toBe(0)
  })

  it('handles a huge page and reports progress', async () => {
    const seen: number[] = []
    const { images } = await run(
      [rgbImage(cardSheet({ cols: 2, rows: 1 }))],
      [{ width: 14400, height: 8100, placements: [place(0, 7200, 4050, 3600, 2025)] }],
      { onProgress: (p: { done: number }) => seen.push(p.done) }
    )
    expect(images[0].box).toEqual({ x: 960, y: 270, w: 480, h: 270 })
    expect(seen).toEqual([1])
  })

  it('skips pictures over the pixel limit with a warning', async () => {
    const { images, warnings } = await run(
      [rgbImage(photoRaster(60, 40, 2))],
      [{ placements: [place()] }],
      {
        maxPixels: 100
      }
    )
    expect(images).toHaveLength(0)
    expect(warnings.join()).toContain('too large')
  })

  it('stops at the picture limit and reads unfiltered streams', async () => {
    const raw: PdfImageSpec = { ...rgbImage(photoRaster(20, 20, 6)), raw: true }
    const { images, warnings } = await run(
      [raw],
      [
        {
          placements: [
            place(0, 50, 50, 100, 100),
            place(0, 200, 50, 100, 100),
            place(0, 350, 50, 100, 100)
          ]
        }
      ],
      { maxImages: 2 }
    )
    expect(images).toHaveLength(2)
    expect(warnings.join()).toContain('Stopped after 2')
  })

  it('handles pages without pictures and a stencil that is mostly empty', async () => {
    const { images, units } = await run(
      [{ kind: 'gray', width: 1, height: 1, data: Uint8Array.from([5]) }],
      [{ texts: [{ text: 'no pictures here', x: 50, y: 50 }] }, {}]
    )
    expect(units).toBe(2)
    expect(images).toHaveLength(0)
    const plain = await extractAssets({
      name: 'plain.pdf',
      bytes: new Uint8Array(makePdf(['hello', 'world']))
    })
    expect(plain.images).toHaveLength(0)
    expect(makeRaster(1, 1, () => [0, 0, 0]).width).toBe(1)
  })

  it('throws readable errors for password protected and damaged files', async () => {
    const code = async (bytes: Uint8Array) => {
      try {
        await extractAssets({ name: 'x.pdf', bytes })
      } catch (error) {
        return error instanceof ImportError ? error.code : 'other'
      }
      return 'none'
    }
    expect(await code(new Uint8Array(makePdf(['secret'], { encrypted: true })))).toBe('password')
    expect(await code(new TextEncoder().encode('%PDF-1.4\nthis is not really a pdf'))).toBe(
      'corrupt'
    )
  })
})
