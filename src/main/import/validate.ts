/**
 * Shallow, cheap checks before a file is copied into a style (design 04-create-style.md §6):
 * extension, readable, <= 50 MB, <= 50 files per style, no duplicates (content hash).
 * Deep checks (password, scanned, damaged, no slides) happen when the file is read.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { IMPORT_MESSAGES, type ImportFailureCode } from './errors'
import type { AcceptedFile, RejectedFile, SourceKind } from './types'

export const MAX_FILES_PER_STYLE = 50
export const MAX_FILE_BYTES = 50 * 1024 * 1024

const KINDS: Record<string, SourceKind> = { '.pdf': 'pdf', '.pptx': 'pptx' }

export interface ValidateOptions {
  /** Content hashes of files already in the style. */
  existingHashes: ReadonlySet<string>
  /** How many files the style already has. */
  existingCount: number
  /** Overrides for tests (defaults: the spec's 50 files and 50 MB). */
  maxFiles?: number
  maxFileBytes?: number
}

/** SHA-256 of a file, streamed (never loads a 50 MB file into memory). */
export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * Validates a batch. Accepted files come back sorted by file name (A–Z, numeric) as the spec's queue order;
 * a duplicate inside the batch is rejected too (the first occurrence wins).
 */
export async function validateFiles(
  paths: string[],
  {
    existingHashes,
    existingCount,
    maxFiles = MAX_FILES_PER_STYLE,
    maxFileBytes = MAX_FILE_BYTES
  }: ValidateOptions
): Promise<{ accepted: AcceptedFile[]; rejected: RejectedFile[] }> {
  const accepted: AcceptedFile[] = []
  const rejected: RejectedFile[] = []
  const seen = new Set(existingHashes)
  const reject = (path: string, code: ImportFailureCode) =>
    rejected.push({ fileName: basename(path), code, reason: IMPORT_MESSAGES[code] })

  for (const path of [...paths].sort((a, b) => natural.compare(basename(a), basename(b)))) {
    const kind = KINDS[extname(path).toLowerCase()]
    if (!kind) {
      reject(path, extname(path).toLowerCase() === '.ppt' ? 'old-ppt' : 'unsupported')
      continue
    }
    let size: number
    try {
      const info = await stat(path)
      if (!info.isFile()) throw new Error('not a file')
      size = info.size
    } catch {
      reject(path, 'missing')
      continue
    }
    if (size > maxFileBytes) reject(path, 'too-large')
    else if (existingCount + accepted.length >= maxFiles) reject(path, 'too-many')
    else {
      let hash: string
      try {
        hash = await hashFile(path)
      } catch {
        reject(path, 'missing')
        continue
      }
      if (seen.has(hash)) reject(path, 'duplicate')
      else {
        seen.add(hash)
        accepted.push({ path, fileName: basename(path), kind, size, hash })
      }
    }
  }
  return { accepted, rejected }
}
