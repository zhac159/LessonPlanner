/** Test-only builders for real files: small .pptx (pptxgenjs) and hand-written PDFs. Never imported by app code. */
import PptxGenJS from 'pptxgenjs'

export interface TestSlide {
  title: string
  body?: string
  /** Hex without #, draws a filled rectangle. */
  shape?: string
}

/** A small 16:9 deck: title text (Lexend 40pt bold teal), optional body (Lexend 20pt) and a coloured box. */
export async function makePptx(slides: TestSlide[]): Promise<Buffer> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  pres.theme = { headFontFace: 'Lexend', bodyFontFace: 'Lexend' }
  for (const spec of slides) {
    const slide = pres.addSlide()
    slide.addText(spec.title, {
      x: 0.5,
      y: 0.4,
      w: 9,
      h: 1,
      fontFace: 'Lexend',
      fontSize: 40,
      bold: true,
      color: '0E7C7B'
    })
    if (spec.body) {
      slide.addText(spec.body, {
        x: 0.5,
        y: 1.8,
        w: 5,
        h: 2,
        fontFace: 'Lexend',
        fontSize: 20,
        color: '12263A'
      })
    }
    if (spec.shape) {
      slide.addShape('rect', { x: 6, y: 2, w: 3, h: 1.5, fill: { color: spec.shape } })
    }
  }
  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer
}

const hex32 = '00'.repeat(32)

/**
 * Minimal valid PDF, one entry per page (the text drawn in Helvetica; '' draws nothing = a blank page).
 * `encrypted` adds a Standard security handler whose user key never matches, so opening needs a password.
 */
export function makePdf(pages: string[], opts: { encrypted?: boolean } = {}): Buffer {
  const objects: string[] = []
  const pageIds = pages.map((_, i) => 4 + i * 2)
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  pages.forEach((text, i) => {
    const stream = text
      ? `BT /F1 24 Tf 72 700 Td (${text.replace(/[()\\]/g, (c) => '\\' + c)}) Tj ET`
      : ''
    const pageId = pageIds[i]
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  const encryptId = objects.length
  if (opts.encrypted) {
    objects[encryptId] = `<< /Filter /Standard /V 1 /R 2 /O <${hex32}> /U <${hex32}> /P -4 >>`
  }
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = body.length
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = body.length
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id++)
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  const extra = opts.encrypted
    ? ` /Encrypt ${encryptId} 0 R /ID [<${'11'.repeat(16)}> <${'11'.repeat(16)}>]`
    : ''
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R${extra} >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}
