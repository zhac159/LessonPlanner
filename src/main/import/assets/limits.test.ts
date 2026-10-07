import { deflateSync, inflateSync } from 'node:zlib'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { decodeImage } from './decode'
import { extractAssets } from '.'
import { MAX_DECODE_PIXELS, TOO_LARGE_TO_READ, UnsafeFileError, pngInflatedLimit } from './limits'
import { decodePng, pngChunk } from './png'
import { makePptxWithPictures } from './testFiles'
import { badgeRaster, interlacedPng, pngOf, photoRaster } from './testRasters'
import { zipReader } from './zipRead'

const MB = 1024 * 1024
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A PNG whose header says width x height (RGBA, 8 bit) and whose zlib data is `inflatedBytes` of zeros. */
function bombPng(width: number, height: number, inflatedBytes: number): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return new Uint8Array(
    Buffer.concat([
      SIGNATURE,
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(Buffer.alloc(inflatedBytes), { level: 9 })),
      pngChunk('IEND', Buffer.alloc(0))
    ])
  )
}

/** A zip with one part that inflates to `bytes` zeros: a few KB on disk. */
async function bombZip(path: string, bytes: number): Promise<JSZip> {
  const zip = new JSZip()
  zip.file(path, Buffer.alloc(bytes), { compression: 'DEFLATE', compressionOptions: { level: 9 } })
  return JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}

describe('png decompression bombs', () => {
  it('refuses zlib data that is longer than the header allows, before it is all inflated', () => {
    const bomb = bombPng(100, 100, 30 * MB) // header allows 40 100 bytes
    expect(bomb.length).toBeLessThan(100_000)
    expect(() => decodePng(bomb)).toThrow(UnsafeFileError)
    expect(() => decodePng(bomb)).toThrow(TOO_LARGE_TO_READ)
    // the same through the default decoder: no raster, no crash
    return expect(decodeImage(bomb, 'image/png')).resolves.toBeNull()
  })

  it('refuses a picture over the pixel cap before inflating anything', () => {
    const huge = bombPng(10_000, 10_000, 64) // 100 M pixels
    expect(() => decodePng(huge)).toThrow(UnsafeFileError)
    expect(() => decodePng(bombPng(8, 8, 64), 10)).toThrow(UnsafeFileError)
    expect(MAX_DECODE_PIXELS).toBe(40_000_000)
    return expect(decodeImage(huge, 'image/png')).resolves.toBeNull()
  })

  it('still decodes honest pictures: the limit is exactly what the header needs', () => {
    expect(decodePng(pngOf(photoRaster(33, 17, 3))).width).toBe(33)
    expect(decodePng(pngOf(badgeRaster(64))).height).toBe(64)
  })

  it('computes the exact inflated size, interlaced images included', () => {
    const raster = photoRaster(13, 11, 9)
    const png = interlacedPng(raster)
    const idat = Buffer.concat(
      [...Buffer.from(png).toString('latin1').matchAll(/IDAT/g)].map((m) => {
        const at = m.index!
        const length = Buffer.from(png).readUInt32BE(at - 4)
        return Buffer.from(png).subarray(at + 4, at + 4 + length)
      })
    )
    expect(inflateSync(idat).length).toBe(pngInflatedLimit(13, 11, 8, 6, 1))
    expect(pngInflatedLimit(13, 11, 8, 6, 0)).toBe(11 * (1 + 13 * 4))
    expect(pngInflatedLimit(10, 10, 3, 6, 0)).toBeNull()
    expect(pngInflatedLimit(0, 10, 8, 6, 0)).toBeNull()
  })
})

describe('zip reading is capped on the bytes that actually come out', () => {
  it('stops a part that inflates past its cap, however small the zip is', async () => {
    const zip = await bombZip('ppt/media/image1.png', 40 * MB)
    const read = zipReader(zip, { mediaBytes: 1 * MB })
    await expect(read.bytes('ppt/media/image1.png')).rejects.toThrow(TOO_LARGE_TO_READ)
    await expect(zipReader(zip, { xmlBytes: 1 * MB }).text('ppt/media/image1.png')).rejects.toThrow(
      TOO_LARGE_TO_READ
    )
  })

  it('does not trust the size the zip header claims', async () => {
    const zip = new JSZip()
    zip.file('a.xml', Buffer.alloc(8 * MB), { compression: 'DEFLATE' })
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    // forge the uncompressed size to 10 bytes in the local and the central header
    for (const [signature, at] of [
      [0x04034b50, 22],
      [0x02014b50, 24]
    ] as const) {
      const header = bytes.indexOf(Buffer.from(new Uint32Array([signature]).buffer))
      bytes.writeUInt32LE(10, header + at)
    }
    const forged = await JSZip.loadAsync(bytes)
    await expect(zipReader(forged, { xmlBytes: 1 * MB }).text('a.xml')).rejects.toBeInstanceOf(
      UnsafeFileError
    )
  })

  it('counts every part against one total, and reads normal parts fine', async () => {
    const zip = new JSZip()
    for (const name of ['a', 'b', 'c']) zip.file(`${name}.bin`, Buffer.alloc(600_000, 1))
    const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }))
    const read = zipReader(loaded, { mediaBytes: 1 * MB, totalBytes: 1_500_000 })
    expect((await read.bytes('a.bin'))?.length).toBe(600_000)
    expect((await read.bytes('b.bin'))?.length).toBe(600_000)
    await expect(read.bytes('c.bin')).rejects.toThrow(TOO_LARGE_TO_READ)
    expect(await read.bytes('missing.bin')).toBeUndefined()
  })
})

describe('extractAssets on hostile decks', () => {
  const deckWith = async (edit: (zip: JSZip) => void): Promise<Uint8Array> => {
    const zip = await JSZip.loadAsync(
      await makePptxWithPictures([
        { pictures: [{ png: pngOf(badgeRaster(60)), x: 1, y: 1, w: 1, h: 1 }] }
      ])
    )
    edit(zip)
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  }

  it('rejects a deck whose slide XML inflates past the cap, with the readable reason', async () => {
    const bytes = await deckWith((zip) =>
      zip.file('ppt/slides/slide1.xml', `<p:sld>${' '.repeat(3 * MB)}</p:sld>`)
    )
    const error = await extractAssets(
      { name: 'Bomb.pptx', bytes },
      { zipLimits: { xmlBytes: 1 * MB } }
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UnsafeFileError)
    expect((error as Error).message).toBe('This file is too large to read safely')
  })

  it('skips one oversized picture with a note and keeps the rest', async () => {
    const bytes = await deckWith(() => undefined)
    const result = await extractAssets(
      { name: 'Deck.pptx', bytes },
      { zipLimits: { mediaBytes: 200 } }
    )
    expect(result.images).toHaveLength(0)
    expect(result.warnings.join(' ')).toContain('too large to read safely')
  })

  it('rejects the deck when everything it inflates adds up past the total cap', async () => {
    const bytes = await deckWith(() => undefined)
    await expect(
      extractAssets({ name: 'Deck.pptx', bytes }, { zipLimits: { totalBytes: 500 } })
    ).rejects.toThrow(TOO_LARGE_TO_READ)
  })
})
