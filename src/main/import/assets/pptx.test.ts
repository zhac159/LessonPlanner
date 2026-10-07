import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { describe, expect, it } from 'vitest'
import { ImportError } from '../errors'
import { extractAssets, groupFindings } from '.'
import { makePptxWithPictures, type PptxSlideSpec } from './testFiles'
import { badgeRaster, cardSheet, dataUri, photoRaster, pngOf } from './testRasters'

const logo = pngOf(badgeRaster(120))
const photoA = pngOf(photoRaster(500, 380, 11))
const photoB = pngOf(photoRaster(560, 420, 12))
const tiny = pngOf(badgeRaster(30))

/** 5 slides with the same logo top right, two different photos on slides 2 and 4, a speck on slide 3. */
async function deck(extra: PptxSlideSpec[] = []) {
  const logoAt = { png: logo, x: 8.7, y: 0.1, w: 1, h: 1 }
  const slides: PptxSlideSpec[] = [
    { pictures: [logoAt], texts: [{ text: 'Welcome', x: 0.5, y: 2, w: 5, h: 1 }] },
    {
      pictures: [logoAt, { png: photoA, x: 2, y: 1.2, w: 4, h: 3 }],
      texts: [{ text: 'Cave painting', x: 2, y: 4.3, w: 4, h: 0.5 }]
    },
    { pictures: [logoAt, { png: tiny, x: 0.2, y: 5, w: 0.15, h: 0.15 }] },
    { pictures: [logoAt, { png: photoB, x: 1, y: 0.8, w: 4, h: 3 }] },
    { pictures: [logoAt] },
    ...extra
  ]
  return makePptxWithPictures(slides)
}

const run = async (buffer: Buffer, name = 'Deck.pptx') =>
  extractAssets({ name, bytes: new Uint8Array(buffer) })

describe('extractAssets: pptx', () => {
  it('finds every picture with slide number, grid position, hash and size', async () => {
    const result = await run(await deck())
    expect(result.sourceKind).toBe('pptx')
    expect(result.units).toBe(5)
    expect(result.scanned).toBe(false)
    // 5 logos + 2 photos + 1 speck
    expect(result.images).toHaveLength(8)
    const logos = result.images.filter((i) => i.hash === result.images[0].hash)
    expect(logos).toHaveLength(5)
    expect(logos.map((i) => i.pageOrSlide)).toEqual([1, 2, 3, 4, 5])
    const first = logos[0]
    expect(first.mime).toBe('image/png')
    expect(first.width).toBe(120)
    expect(first.hash).toHaveLength(64)
    expect(first.perceptualHash).toHaveLength(16)
    // 8.7in of 10in -> 1670 on the 1920 grid; 1in square = 192 wide, 192 tall (16:9 slide is 5.625in high)
    expect(first.box.x).toBeCloseTo(1670, -1)
    expect(first.box.w).toBeCloseTo(192, -1)
    expect(first.box.h).toBeCloseTo(192, -1)
    expect(first.rotation).toBe(0)
  })

  it('marks the logo as repeating on every slide and as a logo, and the others as photos', async () => {
    const { images } = await run(await deck())
    const logos = images.filter((i) => i.width === 120)
    expect(logos.every((i) => i.repeatedOn.join() === '1,2,3,4,5')).toBe(true)
    expect(logos.every((i) => i.kindHint === 'logo')).toBe(true)
    expect(logos[0].duplicateOf).toBeUndefined()
    expect(logos.slice(1).every((i) => i.duplicateOf === logos[0].id)).toBe(true)
    const photos = images.filter((i) => i.width === 500 || i.width === 560)
    expect(photos).toHaveLength(2)
    expect(photos.every((i) => i.kindHint === 'photo' && i.repeatedOn.length === 1)).toBe(true)
  })

  it('ignores a tiny decoration when grouping and merges the repeated logo into one asset', async () => {
    const { images } = await run(await deck())
    const speck = images.find((i) => i.width === 30)
    expect(speck?.quality.tooSmall).toBe(true)
    const findings = groupFindings(images)
    expect(findings.found).toBe(3)
    expect(findings.keeping).toBe(3)
    expect(findings.ignored).toEqual({ tooSmall: 1, thin: 0, fullPage: 0 })
    const logoAsset = findings.assets.find((a) => a.kind === 'logo')
    expect(logoAsset?.foundOn).toBe(5)
    expect(logoAsset?.foundIn).toEqual([{ fileName: 'Deck.pptx', units: [1, 2, 3, 4, 5] }])
    expect(logoAsset?.suggestedName).toBe('school_logo')
    expect(logoAsset?.occurrenceIds).toHaveLength(5)
    // the label under the cave painting names it
    expect(findings.assets.map((a) => a.suggestedName)).toContain('cave_painting')
  })

  it('reads the text next to a picture and the whole slide text', async () => {
    const { images } = await run(await deck())
    const cave = images.find((i) => i.width === 500)
    expect(cave?.nearbyText).toBe('Cave painting')
    expect(cave?.slideText).toContain('Cave painting')
    expect(images.find((i) => i.width === 560)?.nearbyText).toBe('')
  })

  it('passes the media bytes through untouched', async () => {
    const { images } = await run(await deck())
    const cave = images.find((i) => i.width === 500)
    expect(Buffer.from(cave!.bytes).equals(Buffer.from(photoA))).toBe(true)
  })

  it('records rotation (with the bounding box) and the crop rectangle', async () => {
    const buffer = await makePptxWithPictures([
      { pictures: [{ png: photoA, x: 1, y: 1, w: 4, h: 2, rotate: 90 }] },
      {
        pictures: [
          {
            png: photoB,
            x: 1,
            y: 1,
            w: 2,
            h: 2,
            crop: { x: 0.5, y: 0.5, w: 2, h: 2 },
            altText: 'Moose'
          }
        ]
      }
    ])
    const { images } = await run(buffer)
    const rotated = images[0]
    expect(rotated.rotation).toBe(90)
    // the visible box of a 90 degree turn swaps width and height around the centre
    expect(rotated.box.w).toBeCloseTo(2 * 192, -1)
    expect(rotated.box.h).toBeCloseTo(4 * 192, -1)
    const cropped = images[1]
    expect(cropped.crop).toBeDefined()
    expect((cropped.crop?.l ?? 0) + (cropped.crop?.t ?? 0)).toBeGreaterThan(0)
    expect(cropped.altText).toBe('Moose')
    // the stored bitmap is the whole picture
    expect(cropped.width).toBe(560)
  })

  it('finds a logo on the slide master once and credits every slide that shows it', async () => {
    const buffer = await makePptxWithPictures(
      [{ withMaster: true }, { withMaster: true }, { withMaster: true }, {}],
      { masterLogo: logo }
    )
    const { images, units } = await run(buffer)
    expect(units).toBe(4)
    const shared = images.filter((i) => i.origin === 'layout' || i.origin === 'master')
    expect(shared.length).toBeGreaterThan(0)
    expect(shared[0].repeatedOn).toEqual([1, 2, 3])
    expect(shared[0].kindHint).toBe('logo')
    const findings = groupFindings(images)
    expect(findings.found).toBe(1)
    expect(findings.assets[0].foundOn).toBe(3)
  })

  it('splits nothing by itself but flags a card sheet and reads its labels', async () => {
    const sheet = pngOf(cardSheet({ cols: 3, rows: 1, seed: 4 }))
    const buffer = await makePptxWithPictures([
      {
        pictures: [{ png: sheet, x: 1, y: 1, w: 6, h: 2 }],
        texts: [{ text: 'wolf', x: 1, y: 3.2, w: 2, h: 0.4 }]
      }
    ])
    const { images } = await run(buffer)
    expect(images[0].cardCount).toBe(3)
    expect(images[0].kindHint).toBe('symbol-card')
    expect(images[0].nearbyText).toBe('wolf')
  })

  it('reports progress and stops when asked', async () => {
    const buffer = await deck()
    const seen: number[] = []
    await extractAssets(
      { name: 'Deck.pptx', bytes: new Uint8Array(buffer) },
      { onProgress: (p) => seen.push(p.done) }
    )
    expect(seen).toEqual([1, 2, 3, 4, 5])
    const controller = new AbortController()
    controller.abort()
    const stopped = await extractAssets(
      { name: 'Deck.pptx', bytes: new Uint8Array(buffer) },
      { signal: controller.signal }
    )
    expect(stopped.images).toHaveLength(0)
  })

  it('caps the number of pictures and the number of slides, with a warning', async () => {
    const buffer = await deck()
    const capped = await extractAssets(
      { name: 'Deck.pptx', bytes: new Uint8Array(buffer) },
      { maxImages: 3 }
    )
    expect(capped.images).toHaveLength(3)
    expect(capped.warnings.join()).toContain('Stopped after 3')
    const short = await extractAssets(
      { name: 'Deck.pptx', bytes: new Uint8Array(buffer) },
      { maxUnits: 2 }
    )
    expect(short.units).toBe(5)
    expect(short.images.every((i) => i.pageOrSlide <= 2)).toBe(true)
    expect(short.warnings.join()).toContain('first 2 of 5')
  })

  it('treats a picture that cannot be decoded as unreadable but keeps its bytes', async () => {
    const zip = await JSZip.loadAsync(await deck())
    zip.file(
      'ppt/media/image-1-1.png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2])
    )
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const { images } = await extractAssets({ name: 'Broken.pptx', bytes })
    const broken = images.filter((i) => i.quality.unreadable)
    expect(broken.length).toBeGreaterThan(0)
    expect(broken[0].perceptualHash).toBe('')
    const findings = groupFindings(images)
    expect(findings.assets.find((a) => a.image.quality.unreadable)?.leftOut).toBe('unreadable')
  })

  it('throws readable errors for files that are not decks', async () => {
    const code = async (bytes: Uint8Array, name = 'x.pptx') => {
      try {
        await extractAssets({ name, bytes })
      } catch (error) {
        return error instanceof ImportError ? error.code : 'other'
      }
      return 'none'
    }
    expect(await code(new Uint8Array([1, 2, 3, 4]))).toBe('unsupported')
    expect(await code(new Uint8Array())).toBe('corrupt')
    expect(await code(new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9]))).toBe('corrupt')
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])
    expect(await code(ole)).toBe('password')
    expect(await code(ole, 'old.ppt')).toBe('old-ppt')
    const notADeck = await new JSZip().file('hello.txt', 'hi').generateAsync({ type: 'uint8array' })
    expect(await code(notADeck)).toBe('corrupt')
  })
})

describe('extractAssets: pptx picture fills and backgrounds', () => {
  it('finds a background picture and a shape filled with a picture', async () => {
    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_16x9'
    const bg = pres.addSlide()
    bg.background = { data: dataUri(photoA) }
    const fill = pres.addSlide()
    fill.addImage({ data: dataUri(photoB), x: 0.5, y: 0.5, w: 2, h: 1.5 })
    fill.addShape('rect', { x: 4, y: 1, w: 3, h: 2, fill: { color: 'FF0000' } })
    const zip = await JSZip.loadAsync((await pres.write({ outputType: 'nodebuffer' })) as Buffer)
    const slidePath = 'ppt/slides/slide2.xml'
    const xml = (await zip.file(slidePath)?.async('string')) as string
    const patched = xml.replace(
      /<a:solidFill><a:srgbClr val="FF0000"\/><\/a:solidFill>/,
      '<a:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>'
    )
    expect(patched).not.toBe(xml)
    zip.file(slidePath, patched)
    const { images } = await extractAssets({
      name: 'Fills.pptx',
      bytes: await zip.generateAsync({ type: 'uint8array' })
    })
    const background = images.find((i) => i.origin === 'background')
    expect(background?.pageOrSlide).toBe(1)
    expect(background?.box).toEqual({ x: 0, y: 0, w: 1920, h: 1080 })
    const filled = images.find((i) => i.origin === 'fill')
    expect(filled?.box.x).toBeCloseTo(768, -1)
    expect(images.filter((i) => i.origin === 'slide')).toHaveLength(1)
    const findings = groupFindings(images)
    expect(findings.assets.find((a) => a.image.origin === 'background')?.leftOut).toBe('background')
  })
})

describe('extractAssets: repeated by position', () => {
  /** The logo with one pixel changed per slide: a different file each time, the same picture to the eye. */
  const logoCopy = (n: number) => {
    const raster = badgeRaster(120)
    raster.data[(60 * 120 + 60) * 4] = (raster.data[(60 * 120 + 60) * 4] + n * 3) % 256
    return pngOf(raster)
  }

  it('counts a differently encoded logo at the same place as one repeated asset', async () => {
    const slides: PptxSlideSpec[] = [1, 2, 3, 4].map((n) => ({
      pictures: [{ png: logoCopy(n), x: 8.7, y: 0.1, w: 1, h: 1 }]
    }))
    const { images } = await run(await makePptxWithPictures(slides))
    expect(new Set(images.map((i) => i.hash)).size).toBe(4)
    expect(images.every((i) => i.repeatedOn.join() === '1,2,3,4' && i.kindHint === 'logo')).toBe(
      true
    )
    const findings = groupFindings(images)
    expect(findings.found).toBe(1)
    expect(findings.assets[0].foundOn).toBe(4)
  })

  it('does not call different photos in the same template slot a repeated logo', async () => {
    const slides: PptxSlideSpec[] = [21, 22, 23, 24].map((seed) => ({
      pictures: [{ png: pngOf(photoRaster(300, 200, seed)), x: 6, y: 1, w: 3, h: 2 }]
    }))
    const { images } = await run(await makePptxWithPictures(slides))
    expect(images.every((i) => i.repeatedOn.length === 1)).toBe(true)
    expect(groupFindings(images).found).toBe(4)
  })
})
