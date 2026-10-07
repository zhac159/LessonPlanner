/**
 * What she picked or dropped: which files can be read (pictures, PDFs, PowerPoints), and why the others cannot
 * (`RejectedImage`, agents/ASSETS.md §3.2). Reads the files; nothing is saved here.
 */
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { RejectedImage } from '@shared/contracts/assets'
import { MAX_ASSET_BYTES, sniffAssetExt } from '../storeParts'

/** At most this many files in one go; the rest are rejected with `limit`. */
export const MAX_FILES_PER_ADD = 40

export type IntakeKind = 'pptx' | 'pdf' | 'image'

export interface IntakeFile {
  name: string
  kind: IntakeKind
  bytes: Uint8Array
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']

export function kindOfName(name: string): IntakeKind | null {
  const ext = extname(name).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  // `.ppt` is read like `.pptx` so its row says "too old" instead of the file vanishing
  if (ext === '.pptx' || ext === '.ppt') return 'pptx'
  return IMAGE_EXTENSIONS.includes(ext) ? 'image' : null
}

export async function readIntake(
  paths: readonly string[]
): Promise<{ files: IntakeFile[]; rejected: RejectedImage[] }> {
  const files: IntakeFile[] = []
  const rejected: RejectedImage[] = []
  for (const path of paths) {
    const name = basename(path)
    if (files.length >= MAX_FILES_PER_ADD) {
      rejected.push({ name, reason: 'limit' })
      continue
    }
    const kind = kindOfName(name)
    if (!kind) {
      rejected.push({ name, reason: 'type' })
      continue
    }
    try {
      const info = await stat(path)
      if (!info.isFile()) {
        rejected.push({ name, reason: 'type' })
      } else if (info.size === 0) {
        rejected.push({ name, reason: 'empty' })
      } else if (info.size > MAX_ASSET_BYTES) {
        rejected.push({ name, reason: 'too-large' })
      } else {
        const bytes = new Uint8Array(await readFile(path))
        if (kind === 'image' && !sniffAssetExt(bytes)) rejected.push({ name, reason: 'corrupt' })
        else files.push({ name, kind, bytes })
      }
    } catch {
      rejected.push({ name, reason: 'corrupt' })
    }
  }
  return { files, rejected }
}
