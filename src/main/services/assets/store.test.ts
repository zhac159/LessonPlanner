import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { safeParseAsset, safeParseAssetIndex } from '@shared/assets/schema'
import { DELETE_WINDOW_MS, AssetError, AssetStore, sha256, sniffAssetExt } from './store'
import { cleanTemp, newAssetInput, photoPng, svgBytes, tempDir } from './testing'
import { createPureImageTools } from './thumbs'

afterEach(cleanTemp)

let tick = Date.parse('2026-10-07T09:00:00.000Z')
const clock = (): Date => new Date((tick += 1000))

const open = (dir: string) => new AssetStore({ dir, tools: createPureImageTools(), now: clock })
const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false
  )

describe('creating', () => {
  it('writes the file, meta.json and the index, in that order of importance', async () => {
    const dir = await tempDir()
    const store = open(dir)
    await store.load()
    const asset = await store.create(newAssetInput('school_logo', { title: 'School logo' }))
    expect(asset.id).toMatch(/^ast_/)
    expect(asset.file).toMatchObject({ ext: '.png', width: 80, height: 60, vector: false })
    const folder = join(dir, 'library', asset.id)
    expect((await readFile(join(folder, 'file.png'))).byteLength).toBe(asset.file.bytes)
    expect(safeParseAsset(JSON.parse(await readFile(join(folder, 'meta.json'), 'utf8'))).ok).toBe(
      true
    )
    const index = safeParseAssetIndex(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')))
    expect(index.ok && index.index.assets.map((a) => a.name)).toEqual(['school_logo'])
  })

  it('refuses a taken name with the spec message and a bad name', async () => {
    const store = open(await tempDir())
    await store.load()
    await store.create(newAssetInput('owl_mascot'))
    await expect(store.create(newAssetInput('Owl Mascot'))).rejects.toMatchObject({
      code: 'invalid-input',
      message: 'You already have an asset called owl_mascot.'
    })
    await expect(store.create(newAssetInput('slide'))).rejects.toThrow('kept for the app')
  })

  it('takes the next free name when asked to', async () => {
    const store = open(await tempDir())
    await store.load()
    await store.create(newAssetInput('leaf', { bytes: photoPng(1) }))
    const second = await store.create(newAssetInput('leaf', { bytes: photoPng(2), autoName: true }))
    expect(second.name).toBe('leaf_2')
  })

  it('serialises writes: parallel creates all land', async () => {
    const store = open(await tempDir())
    await store.load()
    await Promise.all(
      ['a_one', 'b_two', 'c_three', 'd_four'].map((n) => store.create(newAssetInput(n)))
    )
    expect(store.size).toBe(4)
    expect(new Set(store.list().map((a) => a.id)).size).toBe(4)
  })

  it('cleans tags, title and description and never keeps an empty title', async () => {
    const store = open(await tempDir())
    await store.load()
    const asset = await store.create(
      newAssetInput('forest_photo', {
        title: '   ',
        tags: [' Trees ', 'trees', 'A'.repeat(40)],
        description: 'x'.repeat(500)
      })
    )
    expect(asset.title).toBe('Forest photo')
    expect(asset.tags).toEqual(['trees', 'a'.repeat(24)])
    expect(asset.description).toHaveLength(400)
  })

  it('refuses files that are too big, empty or unreadable', async () => {
    const store = open(await tempDir())
    await store.load()
    await expect(
      store.create(newAssetInput('huge', { bytes: new Uint8Array(50 * 1024 * 1024 + 1) }))
    ).rejects.toMatchObject({ code: 'too-large', message: 'That picture is too big.' })
    await expect(store.create(newAssetInput('empty', { bytes: new Uint8Array() }))).rejects.toThrow(
      'empty'
    )
    await expect(
      store.create(newAssetInput('junk', { bytes: new Uint8Array([1, 2, 3, 4, 5]) }))
    ).rejects.toThrow('cannot be read')
    expect(store.size).toBe(0)
  })

  it('refuses a picture over 10 000 px', async () => {
    const store = open(await tempDir())
    await store.load()
    const tooWide = Uint8Array.from(photoPng(1))
    new DataView(tooWide.buffer).setUint32(16, 10_001)
    await expect(store.create(newAssetInput('wide', { bytes: tooWide }))).rejects.toMatchObject({
      code: 'too-large'
    })
  })

  it('keeps an SVG exactly as it came, checks it, and reports a vector asset', async () => {
    const store = open(await tempDir())
    await store.load()
    const dirty = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>'
    )
    const asset = await store.create(newAssetInput('circle', { bytes: dirty, ext: '.svg' }))
    expect(asset.file.vector).toBe(true)
    const saved = new TextDecoder().decode(await store.readOriginal(asset))
    expect(saved).toBe(new TextDecoder().decode(dirty)) // the original, byte for byte
    expect(asset.file.sha256).toBe(sha256(dirty))
    expect(asset.file.bytes).toBe(dirty.byteLength)
    expect(asset.file.dropped).toEqual(['<script>'])
    await expect(
      store.create(
        newAssetInput('bad', {
          bytes: new TextEncoder().encode('<svg>no viewBox</svg>'),
          ext: '.svg'
        })
      )
    ).rejects.toBeInstanceOf(AssetError)
  })

  it('finds a file type by its first bytes', () => {
    expect(sniffAssetExt(photoPng(1))).toBe('.png')
    expect(sniffAssetExt(svgBytes())).toBe('.svg')
    expect(sniffAssetExt(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('.jpg')
    expect(sniffAssetExt(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe('editing', () => {
  it('renames, edits and marks use; only real edits move updatedAt', async () => {
    const store = open(await tempDir())
    await store.load()
    const first = await store.create(newAssetInput('beaker_icon'))
    const renamed = await store.patch(first.id, { name: 'lab_beaker', tags: ['Lab', 'glass'] })
    expect(renamed).toMatchObject({ name: 'lab_beaker', tags: ['lab', 'glass'] })
    expect(renamed.updatedAt > first.updatedAt).toBe(true)
    const used = await store.patch(first.id, { lastUsedAt: '2026-10-07T12:00:00.000Z' })
    expect(used.lastUsedAt).toBe('2026-10-07T12:00:00.000Z')
    expect(used.updatedAt).toBe(renamed.updatedAt)
    await expect(store.patch('ast_nope', { title: 'x' })).rejects.toMatchObject({
      code: 'not-found'
    })
  })

  it('refuses a rename onto another asset but allows keeping its own name', async () => {
    const store = open(await tempDir())
    await store.load()
    const a = await store.create(newAssetInput('owl_mascot'))
    await store.create(newAssetInput('leaf_icon'))
    await expect(store.patch(a.id, { name: 'LEAF_ICON' })).rejects.toThrow('already have')
    expect((await store.patch(a.id, { name: 'owl_mascot' })).name).toBe('owl_mascot')
  })

  it('replaces the file, keeping name and id, and drops the old thumbnail and extension', async () => {
    const dir = await tempDir()
    const store = open(dir)
    await store.load()
    const asset = await store.create(newAssetInput('banner_one'))
    await writeFile(store.thumbPath(asset.id), 'old')
    const next = await store.replaceFile(asset.id, svgBytes('#080'), '.svg')
    expect(next).toMatchObject({
      id: asset.id,
      name: 'banner_one',
      file: { ext: '.svg', vector: true }
    })
    expect(await exists(join(dir, 'library', asset.id, 'file.png'))).toBe(false)
    expect(await exists(store.thumbPath(asset.id))).toBe(false)
    expect(next.file.sha256).not.toBe(asset.file.sha256)
  })

  it('keeps usedIn as a memory-only cache', async () => {
    const dir = await tempDir()
    const store = open(dir)
    await store.load()
    const asset = await store.create(newAssetInput('logo_one'))
    expect(store.setUsage(new Map([[asset.id, ['les_1', 'les_2']]]))).toBe(true)
    expect(store.setUsage(new Map([[asset.id, ['les_1', 'les_2']]]))).toBe(false)
    expect(store.get(asset.id)?.usedIn).toEqual(['les_1', 'les_2'])
    expect(store.setUsage(new Map())).toBe(true)
  })
})

describe('loading and recovery', () => {
  it('reads back what was saved', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    await first.create(newAssetInput('owl_mascot'))
    await first.create(newAssetInput('leaf_icon'))
    const second = open(dir)
    expect(await second.load()).toEqual({ recovered: 0, setAside: 0, renamed: 0 })
    expect(second.names().sort()).toEqual(['leaf_icon', 'owl_mascot'])
  })

  it('rebuilds a missing or corrupt index from the meta files and reports it', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    await first.create(newAssetInput('owl_mascot'))
    await first.create(newAssetInput('leaf_icon'))
    for (const damage of ['{ not json', JSON.stringify({ schemaVersion: 1 }), null]) {
      if (damage === null) await rm(join(dir, 'index.json'))
      else await writeFile(join(dir, 'index.json'), damage)
      const again = open(dir)
      expect(await again.load()).toMatchObject({ recovered: 2, setAside: 0 })
      expect(again.size).toBe(2)
      expect(
        safeParseAssetIndex(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'))).ok
      ).toBe(true)
    }
  })

  it('catches up an index that is one asset behind (a crash between meta and index)', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    await first.create(newAssetInput('owl_mascot'))
    const stale = await readFile(join(dir, 'index.json'), 'utf8')
    await first.create(newAssetInput('leaf_icon'))
    await writeFile(join(dir, 'index.json'), stale)
    const again = open(dir)
    expect(await again.load()).toMatchObject({ recovered: 1 })
    expect(again.size).toBe(2)
  })

  it('sets a damaged folder aside, untouched, and keeps the rest', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    const good = await first.create(newAssetInput('owl_mascot'))
    const bad = await first.create(newAssetInput('leaf_icon'))
    const nofile = await first.create(newAssetInput('lost_file'))
    await writeFile(join(dir, 'library', bad.id, 'meta.json'), '{"broken":')
    await rm(join(dir, 'library', nofile.id, 'file.png'))
    await rm(join(dir, 'index.json'))
    const again = open(dir)
    expect(await again.load()).toMatchObject({ recovered: 1, setAside: 2 })
    expect(again.list().map((a) => a.id)).toEqual([good.id])
    expect((await readdir(join(dir, 'library', '_damaged'))).sort()).toEqual(
      [bad.id, nofile.id].sort()
    )
    expect(await readFile(join(dir, 'library', '_damaged', bad.id, 'meta.json'), 'utf8')).toBe(
      '{"broken":'
    )
  })

  it('re-hashes a file that changed on disk but keeps the asset', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    const asset = await first.create(newAssetInput('owl_mascot'))
    const replacement = photoPng(77)
    await writeFile(join(dir, 'library', asset.id, 'file.png'), replacement)
    await rm(join(dir, 'index.json'))
    const again = open(dir)
    await again.load()
    expect(again.get(asset.id)?.file.sha256).not.toBe(asset.file.sha256)
    expect(again.get(asset.id)?.file.bytes).toBe(replacement.byteLength)
  })

  it('renames the newer of two assets that share a name', async () => {
    const dir = await tempDir()
    const first = open(dir)
    await first.load()
    const older = await first.create(newAssetInput('owl_mascot'))
    const newer = await first.create(newAssetInput('owl_two', { bytes: photoPng(9) }))
    const meta = join(dir, 'library', newer.id, 'meta.json')
    const edited = JSON.parse(await readFile(meta, 'utf8'))
    await writeFile(meta, JSON.stringify({ ...edited, name: 'Owl_Mascot' }))
    await rm(join(dir, 'index.json'))
    const again = open(dir)
    expect(await again.load()).toMatchObject({ renamed: 1 })
    expect(again.get(older.id)?.name).toBe('owl_mascot')
    expect(again.get(newer.id)?.name).toBe('owl_mascot_2')
    expect(JSON.parse(await readFile(meta, 'utf8')).name).toBe('owl_mascot_2')
  })

  it('starts empty and quiet on a fresh folder', async () => {
    const store = open(await tempDir())
    expect(await store.load()).toEqual({ recovered: 0, setAside: 0, renamed: 0 })
    expect(store.size).toBe(0)
  })
})

describe('soft delete', () => {
  it('moves the asset away, frees its name and brings it back with restore', async () => {
    const dir = await tempDir()
    const store = open(dir)
    await store.load()
    const asset = await store.create(newAssetInput('owl_mascot'))
    await store.remove(asset.id)
    expect(store.get(asset.id)).toBeUndefined()
    expect(await exists(join(dir, 'library', asset.id))).toBe(false)
    expect(await exists(join(dir, 'deleted', asset.id, 'file.png'))).toBe(true)
    const restored = await store.restore(asset.id)
    expect(restored.name).toBe('owl_mascot')
    expect(await exists(join(dir, 'deleted', asset.id))).toBe(false)
    expect(
      safeParseAssetIndex(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8'))).ok
    ).toBe(true)
    expect(await readdir(join(dir, 'library', asset.id))).not.toContain('deleted.json')
  })

  it('refuses to restore when the name was taken meanwhile', async () => {
    const store = open(await tempDir())
    await store.load()
    const asset = await store.create(newAssetInput('owl_mascot'))
    await store.remove(asset.id)
    await store.create(newAssetInput('owl_mascot', { bytes: photoPng(31) }))
    await expect(store.restore(asset.id)).rejects.toMatchObject({
      code: 'invalid-input',
      message: 'That name is taken now. Rename the other asset first.'
    })
    await expect(store.restore('ast_unknown')).rejects.toMatchObject({ code: 'not-found' })
  })

  it('purges deletions older than 7 days at start-up and keeps newer ones', async () => {
    const dir = await tempDir()
    const store = open(dir)
    await store.load()
    const old = await store.create(newAssetInput('old_one'))
    const recent = await store.create(newAssetInput('recent_one'))
    await store.remove(old.id)
    await store.remove(recent.id)
    const marker = join(dir, 'deleted', old.id, 'deleted.json')
    await writeFile(
      marker,
      JSON.stringify({ deletedAt: new Date(tick - DELETE_WINDOW_MS - 5000).toISOString() })
    )
    await mkdir(join(dir, 'deleted', 'ast_nomarker'), { recursive: true })
    await open(dir).load()
    expect(await exists(join(dir, 'deleted', old.id))).toBe(false)
    expect(await exists(join(dir, 'deleted', recent.id))).toBe(true)
    expect(await exists(join(dir, 'deleted', 'ast_nomarker'))).toBe(true)
  })
})
