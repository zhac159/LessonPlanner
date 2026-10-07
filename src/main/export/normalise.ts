/**
 * Post-processing for what PptxGenJS writes. When a paragraph has several runs it repeats the
 * paragraph properties (`<a:pPr>`) before every run; the schema only allows them first in the
 * paragraph. PowerPoint forgives that, other readers (Keynote, Google Slides, LibreOffice) may not.
 */
import JSZip from 'jszip'

const PPR = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g
const PARAGRAPH = /<a:p>([\s\S]*?)<\/a:p>/g

/** Keeps a paragraph's leading `<a:pPr>` and removes any later ones. */
export function dropMisplacedParagraphProps(xml: string): string {
  return xml.replace(PARAGRAPH, (_whole, body: string) => {
    const lead = new RegExp(`^${PPR.source}`).exec(body)?.[0] ?? ''
    return `<a:p>${lead}${body.slice(lead.length).replace(PPR, '')}</a:p>`
  })
}

/** Rewrites every slide part of a finished .pptx so its paragraphs are schema-valid. */
export async function normalisePptx(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  for (const name of slides) {
    const xml = await zip.files[name].async('string')
    zip.file(name, dropMisplacedParagraphProps(xml))
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
