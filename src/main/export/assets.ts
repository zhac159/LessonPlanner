/** Reads lesson assets from a folder, refusing anything that would escape it. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExportIo } from './context'

const SAFE_ASSET_ID = /^[\w][\w.-]*$/

/** `readAsset` over a folder: unsafe ids and missing files both give `undefined`. */
export function folderAssetReader(assetsDir: string): ExportIo['readAsset'] {
  return async (assetId) => {
    if (!SAFE_ASSET_ID.test(assetId) || assetId.includes('..')) return undefined
    try {
      return new Uint8Array(await readFile(join(assetsDir, assetId)))
    } catch {
      return undefined
    }
  }
}
