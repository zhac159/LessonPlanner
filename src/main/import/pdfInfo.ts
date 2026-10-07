/**
 * PDF facts without AI (design/style-profile.md §2.2): page count and per-page text via pdfjs (legacy build,
 * which runs in Node). Detects password-protected, damaged and scanned-images-only files.
 */
import { ImportError } from './errors'
import { looksLikePersonalData } from './privacy'
import type { PdfInfo } from './types'

/** Only the first pages are read for text; Claude is sent the first 40 pages too. */
export const PDF_TEXT_PAGES = 40
/** Fewer printable characters than this across all read pages = "scanned images only". */
const MIN_TEXT_CHARS = 20

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let pdfjs: Promise<PdfJs> | undefined
const loadPdfJs = (): Promise<PdfJs> => (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs'))

function toImportError(error: unknown): ImportError {
  const name = (error as { name?: string } | null)?.name ?? ''
  return new ImportError(name === 'PasswordException' ? 'password' : 'corrupt')
}

/** Reads page count and text. Throws ImportError('password' | 'corrupt' | 'scanned'). */
export async function readPdfInfo(bytes: Uint8Array): Promise<PdfInfo> {
  const lib = await loadPdfJs()
  // pdfjs takes ownership of (detaches) the buffer it is given, so hand it a copy.
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
    throw toImportError(error)
  }
  try {
    const pageText: string[] = []
    for (let n = 1; n <= Math.min(doc.numPages, PDF_TEXT_PAGES); n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      pageText.push(
        (content.items as PdfTextItem[])
          .map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' '))
          .join('')
          .trim()
      )
      page.cleanup()
    }
    const chars = pageText.join('').replace(/\s/g, '').length
    if (doc.numPages === 0) throw new ImportError('corrupt')
    if (chars < MIN_TEXT_CHARS) throw new ImportError('scanned')
    return { pages: doc.numPages, pageText, mayContainNames: looksLikePersonalData(pageText) }
  } catch (error) {
    throw error instanceof ImportError ? error : toImportError(error)
  } finally {
    await task.destroy()
  }
}
