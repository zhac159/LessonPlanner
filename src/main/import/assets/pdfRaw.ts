/**
 * Finds the raw, still-compressed image streams of a PDF so JPEG pictures can be saved byte for byte instead
 * of being decoded and re-encoded (no generation loss, no size blow-up). A light textual scan: image XObjects
 * are always top-level stream objects, never inside object streams, so the plain file text is enough.
 */
import { jpegInfo } from './decode'

export interface RawImage {
  /** Raw stream bytes (a JPEG file when `jpeg`). */
  data: Uint8Array
  /** The only filter is DCTDecode. */
  jpeg: boolean
  /** The picture has a soft mask or colour-key mask, so the bare JPEG would lose its transparency. */
  masked: boolean
  /** A /Decode array (inverted colours) is present. */
  inverted: boolean
}

const OBJ_WITH_STREAM =
  /(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+obj[ \t\r\n]*<<((?:(?!endobj)[\s\S])*?)>>[ \t\r\n]*stream\r?\n/g

/** Raw image streams by object number (the last definition wins, as in incremental updates). */
export function scanImageStreams(pdf: Uint8Array): Map<number, RawImage> {
  const out = new Map<number, RawImage>()
  const text = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength).toString('latin1')
  if (!text.includes('/Image')) return out
  OBJ_WITH_STREAM.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OBJ_WITH_STREAM.exec(text))) {
    const dict = match[3]
    if (!/\/Subtype\s*\/Image\b/.test(dict)) continue
    const start = match.index + match[0].length
    const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict)?.[1]
    let end = length ? start + Number(length) : -1
    if (
      end < 0 ||
      text
        .slice(end, end + 20)
        .replace(/^[\r\n ]+/, '')
        .slice(0, 9) !== 'endstream'
    ) {
      end = text.indexOf('endstream', start)
      if (end < 0) continue
      if (text[end - 1] === '\n') end--
      if (text[end - 1] === '\r') end--
    }
    const filter = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(dict)?.[1] ?? ''
    out.set(Number(match[1]), {
      data: pdf.subarray(start, end),
      jpeg: /^\s*\[?\s*\/DCTDecode\s*\]?\s*$/.test(filter),
      masked: /\/SMask\s+\d+|\/Mask\b/.test(dict),
      inverted: /\/Decode\s*\[/.test(dict)
    })
  }
  return out
}

/**
 * The bare JPEG file to store for a picture, or null when it has to be re-encoded: not a JPEG, masked,
 * inverted, or the file is not what the dictionary says (encryption, truncated stream, size mismatch).
 */
export function passThroughJpeg(
  raw: RawImage | undefined,
  width: number,
  height: number
): Uint8Array | null {
  if (!raw || !raw.jpeg || raw.masked || raw.inverted) return null
  const data = raw.data
  if (data[0] !== 0xff || data[1] !== 0xd8) return null
  const info = jpegInfo(data)
  // CMYK/YCCK JPEGs are not displayable as they are, and pdf.js applies the colour fix-up.
  if (!info || info.width !== width || info.height !== height || ![1, 3].includes(info.components))
    return null
  let end = data.length
  while (end > 2 && !(data[end - 2] === 0xff && data[end - 1] === 0xd9)) end--
  return end > 2 ? data.subarray(0, end) : null
}
