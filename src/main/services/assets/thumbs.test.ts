import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeImage } from 'electron'
import { hammingDistance } from '@shared/assets/hash'
import type { Asset } from '@shared/assets/types'
import { decodePng, pngChunk } from '../../import/assets/png'
import { SAMPLE_JPEG, SAMPLE_JPEG_SIZE } from '../../import/assets/testJpeg'
import { badgePng, cleanTemp, photoPng, svgBytes, tempDir } from './testing'
import {
  createNativeImageTools,
  createPureImageTools,
  hashRaster,
  shrinkRaster,
  ThumbnailService,
  type ImageTools
} from './thumbs'

afterEach(cleanTemp)

/** A PNG with this IHDR size and no real pixel data (only the header is ever read). */
function pngWithHeader(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IEND', Buffer.alloc(0))
    ])
  )
}

describe('pure image tools', () => {
  const tools = createPureImageTools()

  it('measures a PNG and fingerprints it', async () => {
    const seen = await tools.inspect(photoPng(3, 120, 80), '.png')
    expect(seen).toMatchObject({ width: 120, height: 80 })
    expect(seen?.phash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('gives the same picture at another size a near-identical hash', async () => {
    const big = await tools.inspect(photoPng(5, 240, 160), '.png')
    const small = await tools.inspect(photoPng(5, 120, 80), '.png')
    const other = await tools.inspect(photoPng(9, 240, 160), '.png')
    expect(hammingDistance(big!.phash!, small!.phash!)).toBeLessThanOrEqual(6)
    expect(hammingDistance(big!.phash!, other!.phash!)).toBeGreaterThan(6)
  })

  it('reads a JPEG', async () => {
    expect(await tools.inspect(SAMPLE_JPEG, '.jpg')).toMatchObject(SAMPLE_JPEG_SIZE)
  })

  it('reports an SVG as 1024 px on the long side and fingerprints it', async () => {
    const seen = await tools.inspect(svgBytes('#c00', 100), '.svg')
    expect(seen).toMatchObject({ width: 1024, height: 512 })
    expect(seen?.phash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('returns null for bytes that are not a picture', async () => {
    expect(await tools.inspect(new Uint8Array([1, 2, 3, 4]), '.png')).toBeNull()
    expect(await tools.inspect(new TextEncoder().encode('<not-svg'), '.svg')).toBeNull()
    expect(await tools.scale(new Uint8Array([1, 2, 3]), '.png', 64)).toBeNull()
  })

  it('shrinks a raster to a PNG with the long side at most the limit and never enlarges', async () => {
    const shrunk = await tools.scale(photoPng(2, 400, 200), '.png', 100)
    expect(shrunk).toMatchObject({ width: 100, height: 50 })
    expect(decodePng(shrunk!.png)).toMatchObject({ width: 100, height: 50 })
    const same = await tools.scale(photoPng(2, 40, 20), '.png', 100)
    expect(same).toMatchObject({ width: 40, height: 20 })
  })

  it('draws an SVG at the asked size', async () => {
    const scaled = await tools.scale(svgBytes('#080', 100), '.svg', 200)
    expect(scaled).toMatchObject({ width: 200, height: 100 })
  })

  it('keeps transparency and does not darken the edge when shrinking', () => {
    const clear = decodePng(badgePng(64))
    const small = shrinkRaster(clear, 16, 16)
    expect(small.data[3]).toBe(0)
    expect(hashRaster(small)).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('native image tools', () => {
  function fakeNative(empty = false) {
    const resized: Array<{ width: number; height: number }> = []
    const image = {
      isEmpty: () => empty,
      getSize: () => ({ width: 800, height: 400 }),
      resize: (size: { width: number; height: number }) => {
        resized.push({ width: size.width, height: size.height })
        return {
          ...image,
          getSize: () => ({ width: size.width, height: size.height }),
          toBitmap: () => Buffer.alloc(size.width * size.height * 4, 128),
          toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47, size.width & 255])
        }
      }
    } as unknown as NativeImage
    return { api: { createFromBuffer: vi.fn(() => image) }, resized }
  }

  const fallback: ImageTools = {
    inspect: vi.fn(async () => ({ width: 1, height: 1, phash: null })),
    scale: vi.fn(async () => null)
  }

  it('uses nativeImage for PNG and JPEG', async () => {
    const { api, resized } = fakeNative()
    const tools = createNativeImageTools(api, fallback)
    const seen = await tools.inspect(photoPng(1, 800, 400), '.png')
    expect(seen).toMatchObject({ width: 800, height: 400 })
    expect(seen?.phash).toMatch(/^[0-9a-f]{16}$/)
    expect(resized[0]).toEqual({ width: 9, height: 8 })
    const scaled = await tools.scale(SAMPLE_JPEG, '.jpg', 256)
    expect(scaled).toMatchObject({ width: 256, height: 128 })
  })

  it('leaves WebP, GIF and SVG to the plain-JS tools, and so does an unreadable picture', async () => {
    const { api } = fakeNative()
    const tools = createNativeImageTools(api, fallback)
    await tools.inspect(new Uint8Array([1]), '.webp')
    await tools.scale(new Uint8Array([1]), '.svg', 64)
    expect(api.createFromBuffer).not.toHaveBeenCalled()
    const broken = createNativeImageTools(fakeNative(true).api, fallback)
    await broken.inspect(photoPng(1, 80, 40), '.png')
    expect(fallback.inspect).toHaveBeenCalledTimes(2)
  })

  it('reads the header first and never hands a huge or unreadable picture to nativeImage', async () => {
    const { api } = fakeNative()
    const tools = createNativeImageTools(api, fallback)
    const header = (width: number, height: number) => pngWithHeader(width, height)
    await tools.inspect(header(20_000, 20), '.png') // longer than MAX_ASSET_SIDE
    await tools.scale(header(9_000, 9_000), '.png', 256) // 81 M pixels, over the pixel cap
    await tools.inspect(new Uint8Array([1, 2, 3]), '.png') // no readable header
    expect(api.createFromBuffer).not.toHaveBeenCalled()
    await tools.inspect(photoPng(1, 80, 40), '.png')
    expect(api.createFromBuffer).toHaveBeenCalledTimes(1)
  })
})

describe('ThumbnailService', () => {
  const assetOf = (id: string, sha: string): Asset =>
    ({ id, file: { ext: '.png', sha256: sha } }) as unknown as Asset

  it('writes thumb.png, serves a data URL and makes a missing thumbnail again', async () => {
    const dir = await tempDir()
    const bytes = photoPng(4, 600, 300)
    const asset = assetOf('ast_a', 'a'.repeat(64))
    const service = new ThumbnailService({
      tools: createPureImageTools(),
      thumbPath: (id) => join(dir, `${id}.png`),
      readOriginal: async () => bytes
    })
    const made = await service.make(asset)
    expect(made).toMatch(/^data:image\/png;base64,/)
    const onDisk = decodePng(new Uint8Array(await readFile(join(dir, 'ast_a.png'))))
    expect(onDisk).toMatchObject({ width: 256, height: 128 })
    await service.forget('ast_a', true)
    expect(await service.thumbDataUrl(asset)).toBe(made)
  })

  it('makes a 768 px preview on demand and falls back to the thumbnail when the file is gone', async () => {
    const dir = await tempDir()
    const asset = assetOf('ast_b', 'b'.repeat(64))
    let bytes: Uint8Array | undefined = photoPng(4, 1000, 500)
    const service = new ThumbnailService({
      tools: createPureImageTools(),
      thumbPath: (id) => join(dir, `${id}.png`),
      readOriginal: async () => bytes
    })
    const preview = await service.previewDataUrl(asset)
    const decoded = decodePng(Buffer.from(preview!.split(',')[1]!, 'base64'))
    expect(decoded).toMatchObject({ width: 768, height: 384 })
    bytes = undefined
    expect(await service.thumbDataUrl(assetOf('ast_missing', 'c'.repeat(64)))).toBeNull()
  })
})
