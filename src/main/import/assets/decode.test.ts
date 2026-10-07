import { describe, expect, it } from 'vitest'
import { decodeImage, headerSize, jpegInfo, mimeFromName, sniffMime } from './decode'
import { encodeRaster } from './png'
import { SAMPLE_JPEG, SAMPLE_JPEG_SIZE } from './testJpeg'
import { makeRaster } from './testRasters'

const GIF_2X2 = Uint8Array.from(
  Buffer.from('R0lGODlhAgACAIAAAP8AAAAA/yH5BAAAAAAALAAAAAACAAIAAAIDhI9YADs=', 'base64')
)
const SVG = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="#e00"/></svg>'
)

describe('decode', () => {
  it('sniffs the format from the first bytes', () => {
    expect(sniffMime(encodeRaster(makeRaster(2, 2, () => [1, 2, 3])))).toBe('image/png')
    expect(sniffMime(SAMPLE_JPEG)).toBe('image/jpeg')
    expect(sniffMime(GIF_2X2)).toBe('image/gif')
    expect(sniffMime(SVG)).toBe('image/svg+xml')
    expect(sniffMime(new TextEncoder().encode('%PDF-1.4'))).toBeUndefined()
    expect(sniffMime(new Uint8Array([0xd7, 0xcd, 0xc6, 0x9a, 0, 0]))).toBe('image/x-wmf')
  })

  it('maps file names to mime types', () => {
    expect(mimeFromName('ppt/media/image3.PNG')).toBe('image/png')
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg')
    expect(mimeFromName('a.emf')).toBe('image/x-emf')
    expect(mimeFromName('a.txt')).toBeUndefined()
  })

  it('reads sizes from headers', () => {
    expect(jpegInfo(SAMPLE_JPEG)).toEqual({ ...SAMPLE_JPEG_SIZE, components: 3 })
    expect(headerSize(GIF_2X2, 'image/gif')).toEqual({ width: 2, height: 2 })
  })

  it('decodes a JPEG with the decoder inside pdf.js', async () => {
    const raster = await decodeImage(SAMPLE_JPEG, 'image/jpeg')
    expect(raster).not.toBeNull()
    expect(raster?.width).toBe(64)
    expect(raster?.height).toBe(48)
    const centre = (24 * 64 + 32) * 4
    // the yellow disc in the middle: strong red and green, little blue
    expect(raster?.data[centre]).toBeGreaterThan(200)
    expect(raster?.data[centre + 1]).toBeGreaterThan(180)
    expect(raster?.data[centre + 2]).toBeLessThan(140)
  })

  it('decodes GIF and SVG through resvg and gives null for what it cannot read', async () => {
    const gif = await decodeImage(GIF_2X2, 'image/gif')
    expect(gif?.width).toBe(2)
    expect(gif?.data[0]).toBeGreaterThan(200) // top left is red
    const svg = await decodeImage(SVG, 'image/svg+xml')
    expect(svg?.width).toBe(256)
    expect(svg?.height).toBe(128)
    expect(await decodeImage(new Uint8Array([1, 2, 3, 4]), 'image/x-emf')).toBeNull()
    expect(await decodeImage(new Uint8Array([0xff, 0xd8, 0, 0]), 'image/jpeg')).toBeNull()
  })
})
