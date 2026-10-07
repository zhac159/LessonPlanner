/** Local (no AI) preparation of one style source file: digest it and build what Claude needs. */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { StyleFileInput } from '@shared/ai/types'
import { ImportError } from './errors'
import { readPdfInfo } from './pdfInfo'
import type { SourceKind } from './types'

export interface PreparedSource {
  input: StyleFileInput
  /** Pages (pdf) or slides (pptx). */
  units: number
  mayContainNames: boolean
}

/**
 * Reads `path` and digests it. `fileName` is the teacher's original name (the stored copy is renamed).
 * Throws ImportError (password, scanned, corrupt, empty, missing).
 */
export async function prepareSource(
  path: string,
  kind: SourceKind,
  fileName: string = basename(path)
): Promise<PreparedSource> {
  let bytes: Uint8Array
  try {
    bytes = await readFile(path)
  } catch {
    throw new ImportError('missing')
  }
  if (kind === 'pptx') {
    // Loaded on first use: the zip and XML parsers are not needed to start the app.
    const { digestPptx } = await import('./pptxDigest')
    const digest = await digestPptx(bytes)
    return {
      input: { kind: 'pptx', fileName, digest },
      units: digest.slideCount,
      mayContainNames: digest.mayContainNames
    }
  }
  const info = await readPdfInfo(bytes)
  return {
    input: { kind: 'pdf', fileName, pdf: bytes },
    units: info.pages,
    mayContainNames: info.mayContainNames
  }
}
