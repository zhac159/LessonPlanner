/** Recognises the image formats PowerPoint can embed, reading just enough header to get the size. */

/** A raster image PowerPoint can embed. */
export interface RasterInfo {
  kind: 'raster'
  mime: 'image/png' | 'image/jpeg' | 'image/gif'
  width: number
  height: number
}

/** SVG markup stored as an asset (rasterised before embedding). */
export interface SvgInfo {
  kind: 'svg'
  text: string
}

const u32be = (b: Uint8Array, i: number): number =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const u16be = (b: Uint8Array, i: number): number => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number): number => b[i] | (b[i + 1] << 8)

function startsWith(bytes: Uint8Array, ...sig: number[]): boolean {
  return sig.every((v, i) => bytes[i] === v)
}

function pngInfo(bytes: Uint8Array): RasterInfo | undefined {
  if (bytes.length < 24) return undefined
  const width = u32be(bytes, 16)
  const height = u32be(bytes, 20)
  return width > 0 && height > 0 ? { kind: 'raster', mime: 'image/png', width, height } : undefined
}

function gifInfo(bytes: Uint8Array): RasterInfo | undefined {
  if (bytes.length < 10) return undefined
  const width = u16le(bytes, 6)
  const height = u16le(bytes, 8)
  return width > 0 && height > 0 ? { kind: 'raster', mime: 'image/gif', width, height } : undefined
}

/** Walks JPEG segments until a start-of-frame marker, which holds the dimensions. */
function jpegInfo(bytes: Uint8Array): RasterInfo | undefined {
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return undefined
    const marker = bytes[i + 1]
    if (marker === 0xff) {
      i += 1
      continue
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isFrame) {
      const height = u16be(bytes, i + 5)
      const width = u16be(bytes, i + 7)
      return width > 0 && height > 0
        ? { kind: 'raster', mime: 'image/jpeg', width, height }
        : undefined
    }
    i += 2 + u16be(bytes, i + 2)
  }
  return undefined
}

/** Detects PNG, JPEG, GIF and SVG by content (never by file name). `undefined` = unsupported. */
export function sniffImage(bytes: Uint8Array): RasterInfo | SvgInfo | undefined {
  if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47)) return pngInfo(bytes)
  if (startsWith(bytes, 0xff, 0xd8)) return jpegInfo(bytes)
  if (startsWith(bytes, 0x47, 0x49, 0x46, 0x38)) return gifInfo(bytes)
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart()
  if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) {
    return { kind: 'svg', text: new TextDecoder().decode(bytes) }
  }
  return undefined
}
