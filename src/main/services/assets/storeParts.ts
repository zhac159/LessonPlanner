/**
 * Pieces of the library store that need no state: its refusals and limits, what a new asset is made of, the
 * checks a file passes before it is saved, file-system helpers and the name clean-up done while loading.
 */
import { createHash } from 'node:crypto'
import { readdir, rename } from 'node:fs/promises'
import { uniqueAssetName } from '@shared/assets/names'
import {
  ASSET_FILE_EXTENSIONS,
  type Asset,
  type AssetCredit,
  type AssetFileExt,
  type AssetFoundIn,
  type AssetKind,
  type AssetLicence,
  type AssetSource
} from '@shared/assets/types'
import { LIBRARY_SVG, sanitiseSvg } from '@shared/deck/svg'
import type { ErrorCode } from '@shared/result'
import { sniffImage } from '../imageProviders/download'
import type { ImageTools } from './imageTools'

export const DELETE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_ASSET_BYTES = 50 * 1024 * 1024
export const MAX_ASSET_SIDE = 10_000
export const NAME_TAKEN_ON_RESTORE = 'That name is taken now. Rename the other asset first.'
export const DAMAGED = '_damaged'
export const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

/** A refusal the UI can show: the code is one of the contract's (`invalid-input`, `too-large`, `not-found`, `io`). */
export class AssetError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AssetError'
  }
}

/** What a picture file is, by its first bytes ('.jpg' for JPEG); null for anything the library cannot hold. */
export function sniffAssetExt(bytes: Uint8Array): AssetFileExt | null {
  const mime = sniffImage(bytes)
  if (!mime) return null
  return mime === 'image/jpeg'
    ? '.jpg'
    : (`.${mime.split('/')[1]!.replace('svg+xml', 'svg')}` as AssetFileExt)
}

export interface NewAsset {
  /** Only for restoring known ids (seeds, tests); otherwise a new `ast_` id. */
  id?: string
  bytes: Uint8Array
  ext: AssetFileExt
  name: string
  title: string
  kind: AssetKind
  description?: string
  tags?: string[]
  source: AssetSource
  licence: AssetLicence
  credit?: AssetCredit | null
  foundIn?: AssetFoundIn[]
  /** True: a taken or reserved name is replaced by the next free one instead of being refused. */
  autoName?: boolean
}

export interface LoadReport {
  /** Assets put back by rebuilding the index from the meta files. */
  recovered: number
  /** Folders that could not be read and were moved to `library/_damaged`. */
  setAside: number
  /** Assets that shared a name with an older one and got a new name. */
  renamed: number
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

/** `rename` for folders, retried a few times: Windows briefly refuses while an indexer or antivirus looks. */
export async function moveDir(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || attempt >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)))
    }
  }
}

export async function subfolders(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/** Most parts of an SVG named in the "left out" notice. */
const MAX_DROPPED = 12

/**
 * Refuses oversized, empty and unreadable files and measures the picture. An SVG is checked with the sanitiser but
 * stored exactly as it came (`bytes` is always the original): the sanitised copy is only ever made for drawing, and
 * `file.dropped` names what that copy leaves out so the library can warn.
 */
export async function prepareFile(bytes: Uint8Array, ext: AssetFileExt, tools: ImageTools) {
  if (!ASSET_FILE_EXTENSIONS.includes(ext)) {
    throw new AssetError('invalid-input', 'That kind of file cannot be added.')
  }
  if (bytes.byteLength === 0) throw new AssetError('invalid-input', 'That picture is empty.')
  if (bytes.byteLength > MAX_ASSET_BYTES)
    throw new AssetError('too-large', 'That picture is too big.')
  const data = bytes
  let dropped: string[] = []
  if (ext === '.svg') {
    const clean = sanitiseSvg(new TextDecoder().decode(bytes), LIBRARY_SVG)
    if (!clean.ok)
      throw new AssetError('invalid-input', `That vector picture was refused: ${clean.error}.`)
    dropped = clean.lost.slice(0, MAX_DROPPED)
  }
  const seen = await tools.inspect(data, ext)
  if (!seen) throw new AssetError('invalid-input', 'That picture cannot be read.')
  if (seen.width > MAX_ASSET_SIDE || seen.height > MAX_ASSET_SIDE) {
    throw new AssetError('too-large', 'That picture is too big.')
  }
  return {
    bytes: data,
    file: {
      ext,
      width: seen.width,
      height: seen.height,
      bytes: data.byteLength,
      sha256: sha256(data),
      phash: seen.phash,
      vector: ext === '.svg',
      ...(dropped.length > 0 ? { dropped } : {})
    }
  }
}

/**
 * Two assets with one name (a restored delete, a hand edit): the newer one gets the next free name.
 * Replaces entries of `assets` in place and returns the ids that were renamed.
 */
export function fixNames(assets: Asset[], updatedAt: string): Set<string> {
  const taken = new Set<string>()
  const renamed = new Set<string>()
  const oldestFirst = assets
    .map((asset, at) => ({ asset, at }))
    .sort((a, b) => a.asset.createdAt.localeCompare(b.asset.createdAt) || a.at - b.at)
  for (const { asset, at } of oldestFirst) {
    const lower = asset.name.toLowerCase()
    if (!taken.has(lower)) {
      taken.add(lower)
      continue
    }
    const name = uniqueAssetName(asset.name, taken)
    taken.add(name)
    assets[at] = { ...asset, name, updatedAt }
    renamed.add(asset.id)
  }
  return renamed
}
