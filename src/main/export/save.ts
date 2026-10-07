/** Saving an export to disk: sensible file names and atomic writes (temp file, then rename). */
import { randomBytes } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Deck } from '@shared/deck/types'
import { fail, ok, type Result } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import type { ExportIo, ExportResult } from './pptx'
import { cleanInline } from './sanitize'

const MAX_NAME_LENGTH = 120
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const FORBIDDEN_IN_NAMES = /[<>:"/\\|?*\u0000-\u001F]/g

/** `<title>.pptx` made safe for Windows: no forbidden characters, reserved names or trailing dots. */
export function defaultExportName(deck: Pick<Deck, 'title'>): string {
  let base = cleanInline(deck.title).replace(FORBIDDEN_IN_NAMES, '').replace(/\s+/g, ' ').trim()
  base = base.slice(0, MAX_NAME_LENGTH).replace(/[. ]+$/, '')
  if (base === '') base = 'Lesson'
  if (RESERVED_NAMES.test(base)) base = `${base} lesson`
  return `${base}.pptx`
}

/** Writes bytes to `targetPath` atomically: a half-written file is never visible under that name. */
export async function writeFileAtomic(targetPath: string, bytes: Uint8Array): Promise<void> {
  const temp = `${targetPath}.${randomBytes(4).toString('hex')}.tmp`
  await mkdir(dirname(targetPath), { recursive: true })
  try {
    await writeFile(temp, bytes)
    await rename(temp, targetPath)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

/** What a saved export reports: where, the warnings, and what was left out (empty spots, unreadable pictures). */
export type ExportedFile = { path: string } & Pick<
  ExportResult,
  'warnings' | 'skippedSpots' | 'missingAssets'
>

/** Exports the deck and saves it. A file open in PowerPoint is reported as `file-locked`. */
export async function exportToFile(
  deck: Deck,
  style: StyleProfile | null,
  io: ExportIo,
  targetPath: string
): Promise<Result<ExportedFile>> {
  try {
    // pptxgenjs, jszip and friends load on the first export, not at startup (this file is also used for plain saves).
    const { exportDeckToPptx } = await import('./pptx')
    const { bytes, warnings, skippedSpots, missingAssets } = await exportDeckToPptx(deck, style, io)
    await writeFileAtomic(targetPath, bytes)
    return ok({ path: targetPath, warnings, skippedSpots, missingAssets })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
      return fail(
        'file-locked',
        'That file is open in another program. Close it (or pick another name) and try again.'
      )
    }
    const reason = error instanceof Error ? error.message : String(error)
    return fail('io', `The presentation could not be saved: ${reason}`)
  }
}
