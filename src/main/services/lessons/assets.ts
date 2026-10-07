/**
 * `AssetStore`: files kept next to a lesson (`lessons/<id>/assets/`) or, before the lesson exists, in the
 * inbox: the teacher's learning-objective documents and images. Each file is stored as `<assetId><ext>` with
 * its original name in `assets.json`. Callers serialise access per folder (see LessonsService).
 */
import { copyFile, readFile, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { z } from 'zod'
import type { DocumentKind } from '@shared/contracts/deck-builder-chat'
import { fail, ok, type Result } from '@shared/result'
import { writeFileAtomic } from '../../export/save'
import { atomicWriteJson, ensureDir, readJsonSafe } from '../fsx'
import { isSafeId } from './paths'

export type AssetKind = DocumentKind | 'image'

export interface AssetRecord {
  id: string
  /** The original file name, as the teacher knows it. */
  name: string
  kind: AssetKind
  sizeBytes: number
  /** Lower-case extension with the dot, e.g. `.docx`. */
  ext: string
}

export const MAX_ASSET_BYTES = 50 * 1024 * 1024

const KINDS: Record<string, AssetKind> = {
  '.docx': 'docx',
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image'
}

/** Extensions the paperclip accepts (without dots). */
export const ASSET_EXTENSIONS = Object.keys(KINDS).map((e) => e.slice(1))

/** What kind of file a name is, or undefined when it is not one we accept. */
export const kindOfFileName = (name: string): AssetKind | undefined =>
  KINDS[extname(name).toLowerCase()]

const recordSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['docx', 'pdf', 'pptx', 'image']),
  sizeBytes: z.number(),
  ext: z.string()
})
const manifestSchema = z.record(z.string(), recordSchema)

export class AssetStore {
  constructor(
    private readonly dir: string,
    private readonly ids: (prefix: string) => string
  ) {}

  private manifestPath = (): string => join(this.dir, 'assets.json')

  private async manifest(): Promise<Record<string, AssetRecord>> {
    return (await readJsonSafe(this.manifestPath(), (raw) => manifestSchema.parse(raw))) ?? {}
  }

  private filePath = (record: Pick<AssetRecord, 'id' | 'ext'>): string =>
    join(this.dir, `${record.id}${record.ext}`)

  /** Copies a file from disk into the store. */
  async addFile(
    path: string,
    name: string = basename(path)
  ): Promise<Result<{ asset: AssetRecord }>> {
    const checked = this.check(name)
    if (!checked.ok) return checked
    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      return fail('not-found', 'That file can’t be found.')
    }
    if (size > MAX_ASSET_BYTES) return fail('too-large', 'That file is too big to attach.')
    try {
      await ensureDir(this.dir)
      const record = this.newRecord(name, checked.kind, size)
      await copyFile(path, this.filePath(record))
      await this.save(record)
      return ok({ asset: record })
    } catch (error) {
      return fail(
        'io',
        `The file could not be copied: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  private check(name: string): Result<{ kind: AssetKind }> {
    const kind = kindOfFileName(name)
    return kind
      ? ok({ kind })
      : fail(
          'invalid-input',
          'Only Word, PDF and PowerPoint documents and pictures can be attached.'
        )
  }

  private newRecord(name: string, kind: AssetKind, sizeBytes: number): AssetRecord {
    return { id: this.ids('ast'), name, kind, sizeBytes, ext: extname(name).toLowerCase() }
  }

  private async save(record: AssetRecord): Promise<void> {
    await atomicWriteJson(this.manifestPath(), { ...(await this.manifest()), [record.id]: record })
  }

  /**
   * Copy-on-use of a library picture (agents/ASSETS.md §2.4): stored under the LIBRARY asset's own id, so the lesson's
   * `ImageElement.assetId` is the link back. Idempotent: when the id is already here with its file, nothing is
   * written (a later "Replace file" in the library never touches the lesson's copy). `displayName` is the asset's title.
   */
  async addBytesWithId(
    id: string,
    bytes: Uint8Array,
    ext: string,
    displayName: string
  ): Promise<Result<{ asset: AssetRecord; created: boolean }>> {
    if (!isSafeId(id)) return fail('invalid-input', 'That picture can’t be used in a lesson.')
    const extension = ext.toLowerCase()
    if (!/^.[a-z0-9]{2,5}$/.test(extension))
      return fail('invalid-input', 'That kind of picture can’t be used in a lesson.')
    const existing = await this.get(id)
    if (existing && (await this.read(id))) return ok({ asset: existing, created: false })
    try {
      await ensureDir(this.dir)
      const record: AssetRecord = {
        id,
        name: displayName,
        kind: 'image',
        sizeBytes: bytes.byteLength,
        ext: extension
      }
      await writeFileAtomic(this.filePath(record), bytes)
      await this.save(record)
      return ok({ asset: record, created: true })
    } catch (error) {
      return fail(
        'io',
        `The picture could not be copied into the lesson: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /** The record for an id, or undefined (also for ids that could escape the folder). */
  async get(id: string): Promise<AssetRecord | undefined> {
    return isSafeId(id) ? (await this.manifest())[id] : undefined
  }

  /** The stored bytes, or undefined when the id is unknown or the file is gone. */
  async read(id: string): Promise<Uint8Array | undefined> {
    const record = await this.get(id)
    if (!record) return undefined
    try {
      return await readFile(this.filePath(record))
    } catch {
      return undefined
    }
  }

  /** Moves one asset into another store (inbox -> lesson). False when it is not here. */
  async moveTo(target: AssetStore, id: string): Promise<boolean> {
    const record = await this.get(id)
    const bytes = await this.read(id)
    if (!record || !bytes) return false
    await ensureDir(target.dir)
    await writeFileAtomic(target.filePath(record), bytes)
    await target.save(record)
    await this.remove(id)
    return true
  }

  async remove(id: string): Promise<void> {
    const manifest = await this.manifest()
    const record = manifest[id]
    if (!record) return
    delete manifest[id]
    await atomicWriteJson(this.manifestPath(), manifest)
    await rm(this.filePath(record), { force: true })
  }
}
