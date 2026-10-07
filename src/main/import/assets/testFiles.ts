/** Test-only: builds real .pptx (pptxgenjs) and hand-written .pdf files that contain pictures. */
import { deflateSync } from 'node:zlib'
import PptxGenJS from 'pptxgenjs'
import { dataUri } from './testRasters'

export interface PptxPicture {
  png: Uint8Array
  /** Inches on the 10 x 5.625 slide. */
  x: number
  y: number
  w: number
  h: number
  rotate?: number
  /** Keep only this part (inches, from the picture's top left): a:srcRect. */
  crop?: { x: number; y: number; w: number; h: number }
  altText?: string
}

export interface PptxSlideSpec {
  pictures?: PptxPicture[]
  texts?: Array<{ text: string; x: number; y: number; w: number; h: number }>
  /** Use the master that carries the logo. */
  withMaster?: boolean
}

export async function makePptxWithPictures(
  slides: PptxSlideSpec[],
  options: { masterLogo?: Uint8Array } = {}
): Promise<Buffer> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  if (options.masterLogo) {
    pres.defineSlideMaster({
      title: 'LOGO_MASTER',
      objects: [{ image: { x: 8.7, y: 0.1, w: 1, h: 1, data: dataUri(options.masterLogo) } }]
    })
  }
  for (const spec of slides) {
    const slide = pres.addSlide(spec.withMaster ? { masterName: 'LOGO_MASTER' } : undefined)
    for (const text of spec.texts ?? []) {
      slide.addText(text.text, { x: text.x, y: text.y, w: text.w, h: text.h, fontSize: 18 })
    }
    for (const pic of spec.pictures ?? []) {
      slide.addImage({
        data: dataUri(pic.png),
        x: pic.x,
        y: pic.y,
        w: pic.w,
        h: pic.h,
        rotate: pic.rotate,
        altText: pic.altText,
        sizing: pic.crop ? { type: 'crop', ...pic.crop } : undefined
      })
    }
  }
  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer
}

export type PdfImageKind = 'rgb' | 'gray' | 'cmyk' | 'indexed' | 'mask' | 'jpeg'

export interface PdfImageSpec {
  kind: PdfImageKind
  width: number
  height: number
  /** Raw samples (8 bit; 1 bit per pixel for `mask`, packed per row). A complete JPEG file for `jpeg`. */
  data: Uint8Array
  /** One gray byte per pixel: becomes the soft mask. */
  smask?: Uint8Array
  /** RGB triples for `indexed`. */
  palette?: Uint8Array
  /** Store without compression (only for tests of unfiltered streams). */
  raw?: boolean
}

export interface PdfPlacement {
  image: number
  /** Points from the bottom left of the page. */
  x: number
  y: number
  w: number
  h: number
  /** Rectangular clip in points (x, y, w, h) applied before drawing. */
  clip?: [number, number, number, number]
  rotate?: number
}

export interface PdfPageSpec {
  width?: number
  height?: number
  texts?: Array<{ text: string; x: number; y: number; size?: number }>
  placements?: PdfPlacement[]
}

function colorSpaceOf(image: PdfImageSpec): string {
  switch (image.kind) {
    case 'gray':
      return '/ColorSpace /DeviceGray /BitsPerComponent 8'
    case 'cmyk':
      return '/ColorSpace /DeviceCMYK /BitsPerComponent 8'
    case 'indexed': {
      const palette = image.palette ?? new Uint8Array(3)
      return `/ColorSpace [/Indexed /DeviceRGB ${palette.length / 3 - 1} <${Buffer.from(palette).toString('hex')}>] /BitsPerComponent 8`
    }
    case 'mask':
      return '/ImageMask true /BitsPerComponent 1'
    default:
      return '/ColorSpace /DeviceRGB /BitsPerComponent 8'
  }
}

/** A PDF with the given image XObjects placed on the pages by `cm` + `Do`. Hand-written, with a valid xref. */
export function makePdfWithImages(images: PdfImageSpec[], pages: PdfPageSpec[]): Buffer {
  const parts: Buffer[] = []
  const offsets: number[] = []
  let length = 0
  const push = (buf: Buffer | string) => {
    const b = typeof buf === 'string' ? Buffer.from(buf, 'latin1') : buf
    parts.push(b)
    length += b.length
  }
  const object = (id: number, dict: string, stream?: Buffer) => {
    offsets[id] = length
    push(`${id} 0 obj\n<< ${dict}${stream ? ` /Length ${stream.length}` : ''} >>\n`)
    if (stream) {
      push('stream\n')
      push(stream)
      push('\nendstream\n')
    }
    push('endobj\n')
  }

  push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  let next = 4
  const imageIds = images.map((image) => {
    const id = next++
    const smaskId = image.smask ? next++ : undefined
    return { id, smaskId }
  })
  const pageIds = pages.map(() => {
    const id = next++
    next++
    return id
  })
  object(1, '/Type /Catalog /Pages 2 0 R')
  object(
    2,
    `/Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}]`
  )
  object(3, '/Type /Font /Subtype /Type1 /BaseFont /Helvetica')

  images.forEach((image, i) => {
    const { id, smaskId } = imageIds[i]
    const base = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ${colorSpaceOf(image)}`
    const body = Buffer.from(image.data)
    if (image.kind === 'jpeg') {
      object(id, `${base} /Filter /DCTDecode${smaskId ? ` /SMask ${smaskId} 0 R` : ''}`, body)
    } else if (image.raw) {
      object(id, `${base}${smaskId ? ` /SMask ${smaskId} 0 R` : ''}`, body)
    } else {
      object(
        id,
        `${base} /Filter /FlateDecode${smaskId ? ` /SMask ${smaskId} 0 R` : ''}`,
        deflateSync(body)
      )
    }
    if (smaskId && image.smask) {
      object(
        smaskId,
        `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
        deflateSync(Buffer.from(image.smask))
      )
    }
  })

  pages.forEach((page, i) => {
    const pageId = pageIds[i]
    const used = [...new Set((page.placements ?? []).map((p) => p.image))]
    const xobjects = used.map((n) => `/Im${n} ${imageIds[n].id} 0 R`).join(' ')
    let content = ''
    for (const t of page.texts ?? []) {
      content += `BT /F1 ${t.size ?? 18} Tf ${t.x} ${t.y} Td (${t.text.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj ET\n`
    }
    for (const p of page.placements ?? []) {
      const rad = ((p.rotate ?? 0) * Math.PI) / 180
      const [a, b, c, d] = [
        p.w * Math.cos(rad),
        p.w * Math.sin(rad),
        -p.h * Math.sin(rad),
        p.h * Math.cos(rad)
      ]
      content += 'q\n'
      if (p.clip) content += `${p.clip.join(' ')} re W n\n`
      content += `${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${p.x} ${p.y} cm\n/Im${p.image} Do\nQ\n`
    }
    object(
      pageId,
      `/Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width ?? 720} ${page.height ?? 405}] /Resources << /Font << /F1 3 0 R >> /XObject << ${xobjects} >> >> /Contents ${pageId + 1} 0 R`
    )
    object(pageId + 1, '', Buffer.from(content, 'latin1'))
  })

  const xref = length
  push(`xref\n0 ${next}\n0000000000 65535 f \n`)
  for (let id = 1; id < next; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}

/** RGB bytes of a raster (what a /DeviceRGB image stream holds). */
export function rgbBytes(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array((rgba.length / 4) * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i]
    out[j + 1] = rgba[i + 1]
    out[j + 2] = rgba[i + 2]
  }
  return out
}
