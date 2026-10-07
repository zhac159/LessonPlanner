// Real files for the flows: a .pptx (pptxgenjs, the library the app exports with), a tiny PDF, a PNG, and helpers
// to hand them to the app the way a teacher does (drop on a Dropzone) and to read a .pptx back.
import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import { deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A one-page PDF with real text (Helvetica, not embedded), byte offsets computed for a valid xref. */
export function makePdf(text) {
  const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const at of offsets) pdf += `${String(at).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

/** Writes a two-slide .pptx made with pptxgenjs (a title slide and a content slide with bullets). */
export async function writePptx(dir, name = 'Old lesson.pptx') {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  const title = pptx.addSlide()
  title.background = { color: 'FFFFFF' }
  title.addText('Photosynthesis', {
    x: 0.6,
    y: 1.2,
    w: 8,
    h: 1,
    fontSize: 40,
    bold: true,
    color: '1B2B4B'
  })
  const body = pptx.addSlide()
  body.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.3, h: 5.6, fill: { color: '2A9D8F' } })
  body.addText('What plants need', {
    x: 0.6,
    y: 0.4,
    w: 8,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: '1B2B4B'
  })
  body.addText(
    [
      { text: 'Light from the sun', options: { bullet: true, breakLine: true } },
      { text: 'Water from the soil', options: { bullet: true, breakLine: true } },
      { text: 'Carbon dioxide from the air', options: { bullet: true } }
    ],
    { x: 0.6, y: 1.5, w: 8, h: 3, fontSize: 22, color: '1B2B4B' }
  )
  const file = join(dir, name)
  await pptx.writeFile({ fileName: file })
  return file
}

export function writePdf(dir, name = 'Scheme of work.pdf') {
  const file = join(dir, name)
  writeFileSync(file, makePdf('Photosynthesis scheme of work for Year 8 science'))
  return file
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A solid-colour PNG (RGB), valid for decoders and for the app's image import. */
export function makePng(width = 64, height = 48, [r, g, b] = [42, 157, 143]) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const out = Buffer.alloc(body.length + 8)
    out.writeUInt32BE(data.length, 0)
    body.copy(out, 4)
    out.writeUInt32BE(crc32(body), body.length + 4)
    return out
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill([r, g, b]).flat())])
  const raw = Buffer.concat(Array(height).fill(row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

export function writePng(dir, name = 'Leaf.png', color) {
  const file = join(dir, name)
  writeFileSync(file, makePng(64, 48, color))
  return file
}

/**
 * Drops real files on an element exactly as the OS would: the files come from a temporary <input type=file>
 * (so they carry their real paths, which `webUtils.getPathForFile` reads) and a `drop` event carries them.
 */
export async function dropFiles(page, selector, paths) {
  const input = await page.evaluateHandle(() => {
    const element = document.createElement('input')
    element.type = 'file'
    element.multiple = true
    element.style.display = 'none'
    document.body.appendChild(element)
    return element
  })
  await input.asElement().setInputFiles(paths)
  await page.evaluate(
    ([element, target]) => {
      const transfer = new DataTransfer()
      for (const file of element.files) transfer.items.add(file)
      document
        .querySelector(target)
        .dispatchEvent(
          new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
        )
      element.remove()
    },
    [input, selector]
  )
}

/** Reads a .pptx back: slide count, every XML part parsed, and the text of each slide. */
export async function inspectPptx(file) {
  const zip = await JSZip.loadAsync(readFileSync(file))
  const names = Object.keys(zip.files)
  const slideNames = names
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  const xmlErrors = []
  const slideText = []
  for (const name of names.filter((n) => /\.(xml|rels)$/.test(n))) {
    const xml = await zip.file(name).async('string')
    const wellFormed = /^\s*<\?xml[^>]*\?>\s*<[\w:]+[\s\S]*>\s*$/.test(xml) && balanced(xml)
    if (!wellFormed) xmlErrors.push(name)
    if (slideNames.includes(name))
      slideText.push([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' '))
  }
  return {
    slideCount: slideNames.length,
    xmlErrors,
    slideText,
    mediaCount: names.filter((n) => n.startsWith('ppt/media/')).length
  }
}

/** A cheap well-formedness check: every opened tag is closed in order (enough to catch truncated or mangled XML). */
function balanced(xml) {
  const stack = []
  for (const match of xml.matchAll(/<(\/?)([\w:.-]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = match
    if (selfClosing) continue
    if (closing) {
      if (stack.pop() !== name) return false
    } else stack.push(name)
  }
  return stack.length === 0
}

/**
 * Draws a loop (an ellipse in the middle) on the element at the centre of `selector` with synthetic pointer events.
 * Playwright's own mouse.move takes about a second per step in a hidden window, so the events are dispatched in one go;
 * the app's handlers see the same pointerdown, pointermove and pointerup sequence a mouse produces.
 */
export async function drawLoop(page, selector) {
  await page.evaluate((target) => {
    const box = document.querySelector(target).getBoundingClientRect()
    const [cx, cy] = [box.left + box.width / 2, box.top + box.height / 2]
    const [rx, ry] = [box.width * 0.2, box.height * 0.2]
    const element = document.elementFromPoint(cx, cy)
    const fire = (type, x, y) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'mouse',
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true
        })
      )
    fire('pointerdown', cx + rx, cy)
    for (let step = 1; step <= 24; step++) {
      const angle = (step / 24) * Math.PI * 2
      fire('pointermove', cx + rx * Math.cos(angle), cy + ry * Math.sin(angle))
    }
    fire('pointerup', cx + rx, cy)
  }, selector)
}
