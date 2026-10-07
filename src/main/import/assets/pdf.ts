/**
 * Pictures of a .pdf: pdf.js (legacy build, runs in Node) gives the operator list of every page; each image
 * paint operation, with the transformation matrix in effect, tells where the picture sits. JPEGs are saved byte
 * for byte from the raw stream; everything else (Flate, indexed, CMYK, masks, soft masks) is decoded by pdf.js
 * and written as a lossless PNG. A picture that covers the page is a scan, not an asset.
 */
import { ImportError } from '../errors'
import { decodeImage } from './decode'
import { finalise, prepareImage, type Draft, type Prepared } from './finalize'
import { mergeLines, nearbyText, slideTextOf, type TextItem } from './nearText'
import { encodeRaster } from './png'
import { passThroughJpeg, scanImageStreams, type RawImage } from './pdfRaw'
import type { Box, CropRect, ExtractOptions, ExtractionResult, Raster } from './types'

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let pdfjs: Promise<PdfJs> | undefined
const loadPdfJs = (): Promise<PdfJs> => (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs'))

type Matrix = [number, number, number, number, number, number]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `a` applied first, then `b` (PDF order: new = m x ctm). */
const multiply = (m: ArrayLike<number>, ctm: Matrix): Matrix => [
  m[0] * ctm[0] + m[1] * ctm[2],
  m[0] * ctm[1] + m[1] * ctm[3],
  m[2] * ctm[0] + m[3] * ctm[2],
  m[2] * ctm[1] + m[3] * ctm[3],
  m[4] * ctm[0] + m[5] * ctm[2] + ctm[4],
  m[4] * ctm[1] + m[5] * ctm[3] + ctm[5]
]

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5]
]

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

const intersect = (a: Rect, b: Rect): Rect => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1)
})
const area = (r: Rect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0)

interface PdfImageObject {
  width: number
  height: number
  kind?: number
  data?: Uint8ClampedArray | Uint8Array | string
  ref?: string
  bitmap?: unknown
}

/** pdf.js hands out decoded pixels as 1-bit gray (1), RGB (2) or RGBA (3). */
function rasterOf(image: PdfImageObject, isMask: boolean): Raster | null {
  const { width, height, data } = image
  if (!data || typeof data === 'string' || !width || !height) return null
  const pixels = width * height
  const out = new Uint8ClampedArray(pixels * 4)
  const expectBits = Math.ceil(width / 8) * height
  if (isMask || (image.kind === 1 && data.length >= expectBits && data.length < pixels * 3)) {
    const rowBytes = Math.ceil(width / 8)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const bit = (data[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
        const o = (y * width + x) * 4
        if (isMask) {
          // image masks paint where the bit is 0; the picture is a black shape on transparency
          out[o + 3] = bit ? 0 : 255
        } else {
          out[o] = out[o + 1] = out[o + 2] = bit ? 255 : 0
          out[o + 3] = 255
        }
      }
    }
    return { width, height, data: out }
  }
  if (data.length >= pixels * 4) {
    out.set(data.subarray(0, pixels * 4))
    return { width, height, data: out }
  }
  if (data.length >= pixels * 3) {
    for (let i = 0, j = 0; i < pixels * 4; i += 4, j += 3) {
      out[i] = data[j]
      out[i + 1] = data[j + 1]
      out[i + 2] = data[j + 2]
      out[i + 3] = 255
    }
    return { width, height, data: out }
  }
  return null
}

/** Path data of pdf.js 5+: moveTo 0, lineTo 1, curveTo 2, quadTo 3, close 4, each followed by its coordinates. */
function pathPoints(data: ArrayLike<number>): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (let i = 0; i < data.length;) {
    const op = data[i++]
    const count = op === 0 || op === 1 ? 1 : op === 2 ? 3 : op === 3 ? 2 : 0
    for (let k = 0; k < count; k++, i += 2) points.push([data[i], data[i + 1]])
  }
  return points
}

const PASSWORD = 'PasswordException'

export async function extractFromPdf(
  fileName: string,
  bytes: Uint8Array,
  options: Required<Pick<ExtractOptions, 'maxImages' | 'maxUnits' | 'maxPixels'>> & ExtractOptions
): Promise<ExtractionResult> {
  const lib = await loadPdfJs()
  const { OPS } = lib
  const task = lib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    verbosity: 0
  })
  let doc
  try {
    doc = await task.promise
  } catch (error) {
    await task.destroy().catch(() => undefined)
    throw new ImportError(
      (error as { name?: string } | null)?.name === PASSWORD ? 'password' : 'corrupt'
    )
  }
  try {
    if (doc.numPages === 0) throw new ImportError('corrupt')
    const decode = options.decode ?? decodeImage
    const warnings: string[] = []
    const rawStreams: Map<number, RawImage> = new Map()
    try {
      for (const [n, raw] of scanImageStreams(bytes)) rawStreams.set(n, raw)
    } catch {
      warnings.push('Could not read the raw picture streams; pictures are re-encoded losslessly')
    }

    const prepare = async (image: PdfImageObject, isMask: boolean): Promise<Prepared | null> => {
      try {
        const objNumber = image.ref ? /^(\d+)R/.exec(image.ref)?.[1] : undefined
        const jpeg = objNumber
          ? passThroughJpeg(rawStreams.get(Number(objNumber)), image.width, image.height)
          : null
        const pixels = image.width * image.height
        const raster = pixels > options.maxPixels ? null : rasterOf(image, isMask)
        if (jpeg) {
          return await prepareImage(jpeg, 'image/jpeg', {
            raster: pixels > options.maxPixels ? null : (raster ?? undefined),
            decode,
            maxPixels: options.maxPixels
          })
        }
        if (!raster) {
          warnings.push(
            pixels > options.maxPixels
              ? `A ${image.width}x${image.height} picture is too large and was skipped`
              : 'A picture in an unsupported format was skipped'
          )
          return null
        }
        return await prepareImage(encodeRaster(raster), 'image/png', {
          raster,
          decode,
          maxPixels: options.maxPixels
        })
      } catch {
        warnings.push('A picture could not be converted')
        return null
      }
    }

    const units = Math.min(doc.numPages, options.maxUnits)
    if (doc.numPages > units)
      warnings.push(`Only the first ${units} of ${doc.numPages} pages were read`)
    const drafts: Draft[] = []
    const cache = new Map<string, Prepared | null>()
    let capped = false
    let pagesWithFullImage = 0
    let pagesWithText = 0

    for (let pageNo = 1; pageNo <= units; pageNo++) {
      if (options.signal?.aborted) break
      try {
        const page = await doc.getPage(pageNo)
        const viewport = page.getViewport({ scale: 1 })
        const vp = viewport.transform as Matrix
        const sx = 1920 / viewport.width
        const sy = 1080 / viewport.height
        const toGrid = (x: number, y: number): [number, number] => {
          const [vx, vy] = apply(vp, x, y)
          return [vx * sx, vy * sy]
        }

        // text, in grid coordinates
        const fragments: TextItem[] = []
        const content = await page.getTextContent()
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue
          const t = item.transform as number[]
          const [x0, y0] = toGrid(t[4], t[5])
          const [x1, y1] = toGrid(t[4] + item.width, t[5] + item.height)
          fragments.push({
            text: item.str,
            box: {
              x: Math.min(x0, x1),
              y: Math.min(y0, y1),
              w: Math.abs(x1 - x0),
              h: Math.abs(y1 - y0)
            }
          })
        }
        const lines = mergeLines(fragments)
        const slideText = slideTextOf(lines)
        if (slideText.replace(/\s/g, '').length >= 20) pagesWithText++

        const opList = await page.getOperatorList()
        const getObject = (id: string): Promise<PdfImageObject | null> =>
          new Promise((resolve) => {
            const store = id.startsWith('g_') ? page.commonObjs : page.objs
            if (store.has(id)) {
              resolve(store.get(id) as PdfImageObject)
              return
            }
            const timer = setTimeout(() => resolve(null), 4000)
            try {
              store.get(id, (obj: unknown) => {
                clearTimeout(timer)
                resolve(obj as PdfImageObject)
              })
            } catch {
              clearTimeout(timer)
              resolve(null)
            }
          })

        let ctm = IDENTITY
        let clip: Rect | null = null
        let pendingClip = false
        const stack: Array<{ ctm: Matrix; clip: Rect | null }> = []
        let fullImageOnPage = false
        let n = 0

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i]
          const args = opList.argsArray[i] as unknown[] | null
          if (fn === OPS.save || fn === OPS.paintFormXObjectBegin || fn === OPS.beginGroup) {
            stack.push({ ctm, clip })
            if (
              fn === OPS.paintFormXObjectBegin &&
              Array.isArray(args?.[0]) &&
              args[0].length === 6
            )
              ctm = multiply(args[0] as number[], ctm)
          } else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd || fn === OPS.endGroup) {
            const top = stack.pop()
            if (top) {
              ctm = top.ctm
              clip = top.clip
            }
          } else if (fn === OPS.transform && args) {
            ctm = multiply(args as unknown as number[], ctm)
          } else if (fn === OPS.clip || fn === OPS.eoClip) {
            pendingClip = true
          } else if (fn === OPS.constructPath && args) {
            if (pendingClip) {
              pendingClip = false
              const data = (Array.isArray(args[1]) ? args[1][0] : args[1]) as
                ArrayLike<number> | undefined
              if (data && data.length > 0) {
                const m = multiply(ctm, vp)
                const pts = pathPoints(data).map(([x, y]) => apply(m, x, y))
                if (pts.length >= 2) {
                  const r = {
                    x0: Math.min(...pts.map((p) => p[0])) * sx,
                    y0: Math.min(...pts.map((p) => p[1])) * sy,
                    x1: Math.max(...pts.map((p) => p[0])) * sx,
                    y1: Math.max(...pts.map((p) => p[1])) * sy
                  }
                  clip = clip ? intersect(clip, r) : r
                }
              }
            }
          } else if (
            fn === OPS.paintImageXObject ||
            fn === OPS.paintInlineImageXObject ||
            fn === OPS.paintImageMaskXObject
          ) {
            if (drafts.length >= options.maxImages) {
              capped = true
              continue
            }
            const isMask = fn === OPS.paintImageMaskXObject
            const first = args?.[0] as PdfImageObject | string | undefined
            // stencil masks arrive as { data: '<object id>' }; the bits live in the page's object store
            const maskId = isMask && first && typeof first === 'object' ? first.data : undefined
            const image =
              fn === OPS.paintImageXObject
                ? await getObject(String(first))
                : typeof maskId === 'string'
                  ? await getObject(maskId)
                  : (first as PdfImageObject)
            if (!image) {
              warnings.push(`Page ${pageNo}: a picture could not be read`)
              continue
            }
            const cacheKey = image.ref ? `ref:${image.ref}:${isMask}` : undefined
            let prepared = cacheKey ? cache.get(cacheKey) : undefined
            if (prepared === undefined) {
              prepared = await prepare(image, isMask)
              if (cacheKey) cache.set(cacheKey, prepared)
            }
            if (!prepared) continue

            // placement: the unit square through the CTM and the page transform
            const m = multiply(ctm, vp)
            const p00 = apply(m, 0, 0)
            const p10 = apply(m, 1, 0)
            const p01 = apply(m, 0, 1)
            const p11 = apply(m, 1, 1)
            const xs = [p00[0], p10[0], p01[0], p11[0]].map((v) => v * sx)
            const ys = [p00[1], p10[1], p01[1], p11[1]].map((v) => v * sy)
            const full: Rect = {
              x0: Math.min(...xs),
              y0: Math.min(...ys),
              x1: Math.max(...xs),
              y1: Math.max(...ys)
            }
            if (area(full) <= 0) continue
            const pageRect: Rect = { x0: 0, y0: 0, x1: 1920, y1: 1080 }
            const visible = intersect(clip ? intersect(full, clip) : full, pageRect)
            if (area(visible) <= area(full) * 0.01 || area(visible) <= 0) continue
            const rotation =
              ((Math.atan2(p10[1] * sy - p00[1] * sy, p10[0] * sx - p00[0] * sx) * 180) / Math.PI +
                360) %
              360
            let crop: CropRect | undefined
            if (area(visible) < area(full) * 0.98 && (rotation < 0.5 || rotation > 359.5)) {
              const w = full.x1 - full.x0
              const h = full.y1 - full.y0
              crop = {
                l: (visible.x0 - full.x0) / w,
                t: (visible.y0 - full.y0) / h,
                r: (full.x1 - visible.x1) / w,
                b: (full.y1 - visible.y1) / h
              }
            }
            const box: Box = {
              x: Math.round(visible.x0),
              y: Math.round(visible.y0),
              w: Math.round(visible.x1 - visible.x0),
              h: Math.round(visible.y1 - visible.y0)
            }
            if ((box.w * box.h) / (1920 * 1080) >= 0.85) fullImageOnPage = true
            n++
            drafts.push({
              id: `${fileName}#p${pageNo}.${n}`,
              prepared,
              placement: {
                pageOrSlide: pageNo,
                origin: 'slide',
                box,
                rotation: Math.round((rotation < 0.2 || rotation > 359.8 ? 0 : rotation) * 10) / 10,
                crop,
                nearbyText: nearbyText(lines, box),
                slideText
              }
            })
          }
        }
        if (fullImageOnPage) pagesWithFullImage++
        page.cleanup()
      } catch {
        warnings.push(`Page ${pageNo} could not be read`)
      }
      options.onProgress?.({ done: pageNo, total: units })
    }
    if (capped) warnings.push(`Stopped after ${options.maxImages} pictures`)

    const images = finalise(drafts, { fileName, sourceKind: 'pdf', units: doc.numPages })
    const scanned = units > 0 && pagesWithFullImage >= units * 0.8 && pagesWithText <= units * 0.2
    return { fileName, sourceKind: 'pdf', units: doc.numPages, images, scanned, warnings }
  } finally {
    await task.destroy()
  }
}
