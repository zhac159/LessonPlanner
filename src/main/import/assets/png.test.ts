import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodePng, encodePng, encodeRaster, isPng, pngChunk, pngSize } from './png'
import { interlacedPng, makeRaster, photoRaster } from './testRasters'

describe('png', () => {
  it('round-trips RGBA exactly', () => {
    const raster = photoRaster(37, 23, 5)
    for (let i = 3; i < raster.data.length; i += 4) raster.data[i] = (i * 7) % 256
    const back = decodePng(encodePng(raster.data, 37, 23, 'rgba'))
    expect(back.width).toBe(37)
    expect(back.height).toBe(23)
    expect(Array.from(back.data)).toEqual(Array.from(raster.data))
  })

  it('drops the alpha channel when everything is opaque and keeps it otherwise', () => {
    const opaque = photoRaster(10, 10, 1)
    const bytes = encodeRaster(opaque)
    expect(bytes[25]).toBe(2) // colour type 2 = RGB
    expect(Array.from(decodePng(bytes).data)).toEqual(Array.from(opaque.data))
    opaque.data[3] = 100
    expect(encodeRaster(opaque)[25]).toBe(6)
  })

  it('encodes gray and reads the size from the header', () => {
    const gray = new Uint8Array([0, 128, 255, 64])
    const bytes = encodePng(gray, 2, 2, 'gray')
    expect(isPng(bytes)).toBe(true)
    expect(pngSize(bytes)).toEqual({ width: 2, height: 2 })
    expect(Array.from(decodePng(bytes).data.filter((_, i) => i % 4 === 0))).toEqual([
      0, 128, 255, 64
    ])
  })

  it('decodes an Adam7 interlaced image', () => {
    const raster = photoRaster(13, 11, 9)
    const back = decodePng(interlacedPng(raster))
    expect(Array.from(back.data)).toEqual(Array.from(raster.data))
  })

  it('decodes palette images with a transparency table', () => {
    const header = Buffer.alloc(13)
    header.writeUInt32BE(2, 0)
    header.writeUInt32BE(1, 4)
    header[8] = 8
    header[9] = 3
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', header),
      pngChunk('PLTE', Buffer.from([255, 0, 0, 0, 0, 255])),
      pngChunk('tRNS', Buffer.from([255, 40])),
      pngChunk('IDAT', deflateSync(Buffer.from([0, 0, 1]))),
      pngChunk('IEND', Buffer.alloc(0))
    ])
    expect(Array.from(decodePng(png).data)).toEqual([255, 0, 0, 255, 0, 0, 255, 40])
  })

  it('decodes 1-bit gray and 16-bit gray', () => {
    const make = (depth: number, type: number, width: number, row: number[]) => {
      const header = Buffer.alloc(13)
      header.writeUInt32BE(width, 0)
      header.writeUInt32BE(1, 4)
      header[8] = depth
      header[9] = type
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header),
        pngChunk('IDAT', deflateSync(Buffer.from([0, ...row]))),
        pngChunk('IEND', Buffer.alloc(0))
      ])
    }
    const bits = decodePng(make(1, 0, 4, [0b10100000]))
    expect(Array.from(bits.data.filter((_, i) => i % 4 === 0))).toEqual([255, 0, 255, 0])
    const wide = decodePng(make(16, 0, 2, [0xff, 0xff, 0x00, 0x00]))
    expect(Array.from(wide.data.filter((_, i) => i % 4 === 0))).toEqual([255, 0])
  })

  it('throws on files that are not PNGs or are damaged', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow()
    const png = encodeRaster(makeRaster(4, 4, () => [1, 2, 3]))
    expect(() => decodePng(png.subarray(0, 40))).toThrow()
    expect(pngSize(new Uint8Array(30))).toBeNull()
  })
})
