/** The "Where I looked" rows of a batch: counts per file and the words a failed file shows. */
import type { ReviewFile } from '@shared/contracts/assets'
import { isImportError } from '../../../import/errors'
import type { StoredBatch } from './types'

export const SCANNED_MESSAGE = "This PDF is only scanned pages, so there's nothing to cut out."
export const INTERRUPTED_MESSAGE = 'This file was not finished when the app closed. Add it again.'
export const UNREADABLE_PICTURE = 'That picture cannot be read.'

/** "4 found": candidates seen in each deck (a picture she uploaded is one found). */
export function recount(batch: StoredBatch): void {
  for (const file of batch.files) {
    file.found =
      file.kind === 'image'
        ? batch.candidates.filter((c) => c.fileId === file.id).length
        : batch.candidates.filter((c) => c.foundIn.some((f) => f.fileName === file.name)).length
  }
}

/** The text on a failed row: the import service's own words, our two, else a plain fallback. */
export function failureText(error: unknown): string {
  if (isImportError(error)) return error.message
  if (error instanceof Error && [SCANNED_MESSAGE, UNREADABLE_PICTURE].includes(error.message)) {
    return error.message
  }
  return 'This file could not be read.'
}

export const rowKind = (name: string): ReviewFile['kind'] => (/\.pdf$/i.test(name) ? 'pdf' : 'pptx')
