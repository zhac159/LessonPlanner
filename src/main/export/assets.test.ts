import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { folderAssetReader } from './assets'

let root: string
let read: ReturnType<typeof folderAssetReader>
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'export-assets-'))
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'assets', 'leaf.png'), Uint8Array.from([1, 2, 3]))
  writeFileSync(join(root, 'secret.txt'), 'secret')
  read = folderAssetReader(join(root, 'assets'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('folderAssetReader', () => {
  it('reads a file from the folder', async () => {
    expect([...(await read('leaf.png'))!]).toEqual([1, 2, 3])
  })

  it('returns undefined for a missing file', async () => {
    expect(await read('nope.png')).toBeUndefined()
  })

  it('refuses ids that could leave the folder', async () => {
    const ids = ['../secret.txt', '..\\secret.txt', '/etc/passwd', 'C:\\x', 'a/../../secret.txt']
    for (const id of [...ids, '', '..', '.hidden/..']) {
      expect(await read(id), id).toBeUndefined()
    }
  })
})
