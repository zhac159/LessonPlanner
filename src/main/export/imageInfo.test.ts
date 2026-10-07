import { describe, expect, it } from 'vitest'
import { sniffImage } from './imageInfo'
import { makePng } from './testkit'

const text = (s: string): Uint8Array => new TextEncoder().encode(s)

/** Smallest byte sequence our parser accepts as a JPEG with a start-of-frame segment. */
const jpeg = (width: number, height: number, marker = 0xc0): Uint8Array =>
  Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00, // SOI + APP0 (length 4)
    0xff,
    marker,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    0x03,
    0x01,
    0x22,
    0x00,
    0x00,
    0x00
  ])

describe('sniffImage', () => {
  it('reads PNG dimensions from the header', async () => {
    expect(sniffImage(await makePng(320, 180))).toMatchObject({
      kind: 'raster',
      mime: 'image/png',
      width: 320,
      height: 180
    })
  })

  it('reads JPEG dimensions, skipping other segments', () => {
    expect(sniffImage(jpeg(400, 300))).toMatchObject({
      mime: 'image/jpeg',
      width: 400,
      height: 300
    })
    expect(sniffImage(jpeg(640, 480, 0xc2))).toMatchObject({ width: 640, height: 480 })
  })

  it('reads GIF dimensions', () => {
    const gif = Uint8Array.from([...text('GIF89a'), 10, 0, 20, 0, 0, 0])
    expect(sniffImage(gif)).toMatchObject({ mime: 'image/gif', width: 10, height: 20 })
  })

  it('recognises SVG with or without an XML declaration or comment', () => {
    expect(sniffImage(text('<svg viewBox="0 0 1 1"></svg>'))).toMatchObject({ kind: 'svg' })
    expect(
      sniffImage(text('  <?xml version="1.0"?>\n<!-- hi -->\n<svg xmlns="x"/>'))
    ).toMatchObject({
      kind: 'svg'
    })
  })

  it('rejects unsupported, truncated or empty data', () => {
    expect(sniffImage(new Uint8Array())).toBeUndefined()
    expect(sniffImage(text('just some text'))).toBeUndefined()
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeUndefined()
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeUndefined()
    expect(sniffImage(text('RIFF....WEBPVP8 '))).toBeUndefined()
    expect(sniffImage(text('<html><svg></svg></html>'))).toBeUndefined()
  })
})
