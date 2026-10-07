/**
 * The library on disk (agents/ASSETS.md §2.7): `library/<id>/{file<ext>,meta.json,thumb.png}`, `index.json` as a
 * cache that is rebuilt from the per-asset `meta.json` files when it is missing, invalid or behind, and
 * `deleted/<id>` for the 7-day undo window. Every change is serialised (one mutex), writes the picture, then its
 * meta, then the index, and goes through the atomic helpers of fsx.ts. Nothing here knows about Electron.
 */
import { readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkAssetName, uniqueAssetName } from '@shared/assets/names'
import { safeParseAsset, safeParseAssetIndex } from '@shared/assets/schema'
import type { Asset, AssetFileExt } from '@shared/assets/types'
import { newId } from '@shared/ids'
import { writeFileAtomic } from '../../export/save'
import { atomicWriteJson, ensureDir, readJsonSafe } from '../fsx'
import type { ImageTools } from './imageTools'
import { cleanDescription, cleanTitle, normaliseTags } from './library'
import {
  AssetError,
  DAMAGED,
  DELETE_WINDOW_MS,
  fixNames,
  moveDir,
  NAME_TAKEN_ON_RESTORE,
  prepareFile,
  SAFE_ID,
  sha256,
  subfolders,
  type LoadReport,
  type NewAsset
} from './storeParts'

export * from './storeParts'

export interface StoreOptions {
  dir: string
  tools: ImageTools
  now?: () => Date
  log?: { warn(message: string): void }
}

export class AssetStore {
  private assets = new Map<string, Asset>()
  private chain: Promise<unknown> = Promise.resolve()
  private readonly now: () => Date

  constructor(private readonly options: StoreOptions) {
    this.now = options.now ?? (() => new Date())
  }

  // ---- paths ------------------------------------------------------------------------------------

  private get libraryDir(): string {
    return join(this.options.dir, 'library')
  }
  private get deletedDir(): string {
    return join(this.options.dir, 'deleted')
  }
  private get indexPath(): string {
    return join(this.options.dir, 'index.json')
  }
  assetDir = (id: string): string => join(this.libraryDir, id)
  filePath = (asset: Pick<Asset, 'id' | 'file'>): string =>
    join(this.assetDir(asset.id), `file${asset.file.ext}`)
  thumbPath = (id: string): string => join(this.assetDir(id), 'thumb.png')

  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task)
    this.chain = run.catch(() => undefined)
    return run
  }

  // ---- reading ----------------------------------------------------------------------------------

  list = (): readonly Asset[] => [...this.assets.values()]
  get = (id: string): Asset | undefined => this.assets.get(id)
  get size(): number {
    return this.assets.size
  }
  names = (): string[] => [...this.assets.values()].map((a) => a.name)
  byName(name: string): Asset | undefined {
    const wanted = name.toLowerCase()
    return [...this.assets.values()].find((a) => a.name.toLowerCase() === wanted)
  }
  bySha(sha: string): Asset | undefined {
    return [...this.assets.values()].find((a) => a.file.sha256 === sha)
  }

  async readOriginal(asset: Pick<Asset, 'id' | 'file'>): Promise<Uint8Array | undefined> {
    try {
      return new Uint8Array(await readFile(this.filePath(asset)))
    } catch {
      return undefined
    }
  }

  // ---- loading and recovery ---------------------------------------------------------------------

  /** Reads the library (rebuilding the index when needed), purges old deletions. Never throws. */
  load(): Promise<LoadReport> {
    return this.serial(async () => {
      const report: LoadReport = { recovered: 0, setAside: 0, renamed: 0 }
      this.rehashed.clear()
      await ensureDir(this.libraryDir)
      const folders = (await subfolders(this.libraryDir)).filter((f) => f !== DAMAGED)
      const index = await readJsonSafe(this.indexPath, (raw) => {
        const parsed = safeParseAssetIndex(raw)
        if (!parsed.ok) throw new Error(parsed.error)
        return parsed.index
      })
      const known = new Set(index?.assets.map((a) => a.id))
      const inSync =
        index !== undefined &&
        index.assets.length === folders.length &&
        folders.every((f) => known.has(f))
      let assets: Asset[]
      if (inSync) {
        assets = index.assets
      } else {
        const rebuilt = await this.rebuild(folders, report)
        report.recovered = folders.length === 0 ? 0 : rebuilt.filter((a) => !known.has(a.id)).length
        assets = rebuilt
      }
      const renamed = fixNames(assets, this.now().toISOString())
      report.renamed = renamed.size
      this.assets = new Map(assets.map((a) => [a.id, a]))
      for (const id of new Set([...renamed, ...this.rehashed]))
        await this.writeMeta(this.assets.get(id)!)
      if (!inSync || renamed.size > 0) await this.writeIndex()
      await this.purgeDeleted()
      return report
    })
  }

  /** Ids whose hash was refreshed while rebuilding: their meta is rewritten. */
  private rehashed = new Set<string>()

  private async rebuild(folders: string[], report: LoadReport): Promise<Asset[]> {
    const out: Asset[] = []
    for (const id of folders) {
      const meta = await readJsonSafe(join(this.assetDir(id), 'meta.json'), (raw) => {
        const parsed = safeParseAsset(raw)
        if (!parsed.ok) throw new Error(parsed.error)
        return parsed.asset
      })
      const original = meta ? await this.readOriginal(meta) : undefined
      if (!meta || meta.id !== id || !original) {
        await this.setAside(id)
        report.setAside += 1
        continue
      }
      const sha = sha256(original)
      if (sha !== meta.file.sha256) {
        this.options.log?.warn(`Asset ${id}: the file changed on disk; hash updated.`)
        this.rehashed.add(id)
        out.push({ ...meta, file: { ...meta.file, sha256: sha, bytes: original.byteLength } })
      } else {
        out.push(meta)
      }
    }
    return out
  }

  private async setAside(id: string): Promise<void> {
    try {
      const target = join(this.libraryDir, DAMAGED)
      await ensureDir(target)
      let to = join(target, id)
      if (
        await stat(to).then(
          () => true,
          () => false
        )
      )
        to = `${to}_${Date.now()}`
      await moveDir(this.assetDir(id), to)
    } catch (error) {
      this.options.log?.warn(`Could not set aside ${id}: ${String(error)}`)
    }
  }

  private async purgeDeleted(): Promise<void> {
    const cutoff = this.now().getTime() - DELETE_WINDOW_MS
    for (const id of await subfolders(this.deletedDir)) {
      const dir = join(this.deletedDir, id)
      const marker = await readJsonSafe<{ deletedAt: string }>(join(dir, 'deleted.json'))
      const at = marker ? Date.parse(marker.deletedAt) : (await stat(dir)).mtimeMs
      if (!Number.isFinite(at) || at < cutoff) await rm(dir, { recursive: true, force: true })
    }
  }

  // ---- writing ----------------------------------------------------------------------------------

  private writeMeta = (asset: Asset): Promise<void> =>
    atomicWriteJson(join(this.assetDir(asset.id), 'meta.json'), asset)

  private writeIndex = (): Promise<void> =>
    atomicWriteJson(this.indexPath, {
      schemaVersion: 1,
      assets: [...this.assets.values()],
      updatedAt: this.now().toISOString()
    })

  /** Saves a new picture. Names are checked here too, so no caller can break the uniqueness rule. */
  create(input: NewAsset): Promise<Asset> {
    return this.serial(async () => {
      if (input.id !== undefined && (!SAFE_ID.test(input.id) || this.assets.has(input.id))) {
        throw new AssetError('invalid-input', 'That picture already exists.')
      }
      const taken = this.names()
      let name: string
      if (input.autoName) {
        name = uniqueAssetName(input.name, taken)
      } else {
        const checked = checkAssetName(input.name, taken)
        if (!checked.ok) throw new AssetError('invalid-input', checked.message)
        name = checked.name
      }
      const prepared = await prepareFile(input.bytes, input.ext, this.options.tools)
      const at = this.now().toISOString()
      const asset: Asset = {
        id: input.id ?? newId('ast'),
        name,
        title: cleanTitle(input.title, name),
        kind: input.kind,
        description: cleanDescription(input.description ?? ''),
        tags: normaliseTags(input.tags ?? []),
        source: input.source,
        licence: input.licence,
        credit: input.credit ?? null,
        file: prepared.file,
        foundIn: input.foundIn ?? [],
        usedIn: [],
        lastUsedAt: null,
        createdAt: at,
        updatedAt: at
      }
      await ensureDir(this.assetDir(asset.id))
      await writeFileAtomic(this.filePath(asset), prepared.bytes)
      await this.writeMeta(asset)
      this.assets.set(asset.id, asset)
      await this.writeIndex()
      return asset
    })
  }

  /** Changes text fields, the chat name or `lastUsedAt`. `updatedAt` moves unless only `lastUsedAt` changed. */
  patch(
    id: string,
    change: Partial<Pick<Asset, 'name' | 'title' | 'description' | 'kind' | 'tags' | 'lastUsedAt'>>
  ): Promise<Asset> {
    return this.serial(async () => {
      const current = this.assets.get(id)
      if (!current) throw new AssetError('not-found', 'That picture is not in your library.')
      const next: Asset = { ...current }
      if (change.name !== undefined) {
        const checked = checkAssetName(change.name, this.names(), current.name)
        if (!checked.ok) throw new AssetError('invalid-input', checked.message)
        next.name = checked.name
      }
      if (change.title !== undefined) next.title = cleanTitle(change.title, next.name)
      if (change.description !== undefined) next.description = cleanDescription(change.description)
      if (change.kind !== undefined) next.kind = change.kind
      if (change.tags !== undefined) next.tags = normaliseTags(change.tags)
      if (change.lastUsedAt !== undefined) next.lastUsedAt = change.lastUsedAt
      const onlyUse = Object.keys(change).every((k) => k === 'lastUsedAt')
      if (!onlyUse) next.updatedAt = this.now().toISOString()
      await this.writeMeta(next)
      this.assets.set(id, next)
      await this.writeIndex()
      return next
    })
  }

  /** Puts a new file under an existing asset (library only: lessons keep their own copy). */
  replaceFile(id: string, bytes: Uint8Array, ext: AssetFileExt): Promise<Asset> {
    return this.serial(async () => {
      const current = this.assets.get(id)
      if (!current) throw new AssetError('not-found', 'That picture is not in your library.')
      const prepared = await prepareFile(bytes, ext, this.options.tools)
      const next: Asset = { ...current, file: prepared.file, updatedAt: this.now().toISOString() }
      await writeFileAtomic(this.filePath(next), prepared.bytes)
      await this.writeMeta(next)
      if (current.file.ext !== ext) await rm(this.filePath(current), { force: true })
      await rm(this.thumbPath(id), { force: true })
      this.assets.set(id, next)
      await this.writeIndex()
      return next
    })
  }

  /** Sets the cached `usedIn` lists (memory only: the lessons are the truth). True when anything changed. */
  setUsage(usage: ReadonlyMap<string, readonly string[]>): boolean {
    let changed = false
    for (const [id, asset] of this.assets) {
      const next = [...(usage.get(id) ?? [])]
      if (next.length === asset.usedIn.length && next.every((l, i) => l === asset.usedIn[i]))
        continue
      this.assets.set(id, { ...asset, usedIn: next })
      changed = true
    }
    return changed
  }

  /** Moves an asset to the 7-day undo window. */
  remove(id: string): Promise<Asset> {
    return this.serial(async () => {
      const asset = this.assets.get(id)
      if (!asset) throw new AssetError('not-found', 'That picture is not in your library.')
      const target = join(this.deletedDir, id)
      await rm(target, { recursive: true, force: true })
      await ensureDir(this.deletedDir)
      await moveDir(this.assetDir(id), target)
      await writeFile(
        join(target, 'deleted.json'),
        JSON.stringify({ deletedAt: this.now().toISOString() })
      )
      this.assets.delete(id)
      await this.writeIndex()
      return asset
    })
  }

  /** Undo of `remove`; refused when someone took the name meanwhile. */
  restore(id: string): Promise<Asset> {
    return this.serial(async () => {
      const present = this.assets.get(id)
      if (present) return present
      if (!SAFE_ID.test(id))
        throw new AssetError('not-found', 'That picture is not available any more.')
      const source = join(this.deletedDir, id)
      const meta = await readJsonSafe(join(source, 'meta.json'), (raw) => {
        const parsed = safeParseAsset(raw)
        if (!parsed.ok) throw new Error(parsed.error)
        return parsed.asset
      })
      if (!meta || meta.id !== id) {
        throw new AssetError('not-found', 'That picture is not available any more.')
      }
      const taken = this.names().map((n) => n.toLowerCase())
      if (taken.includes(meta.name.toLowerCase())) {
        throw new AssetError('invalid-input', NAME_TAKEN_ON_RESTORE)
      }
      await ensureDir(this.libraryDir)
      await moveDir(source, this.assetDir(id))
      await rm(join(this.assetDir(id), 'deleted.json'), { force: true })
      this.assets.set(id, { ...meta, usedIn: [] })
      await this.writeIndex()
      return this.assets.get(id)!
    })
  }

  /** Waits for every queued change (tests, shutdown). */
  idle(): Promise<void> {
    return this.chain.then(() => undefined)
  }
}
