/**
 * `LessonFiles`: everything about files that sit next to a lesson. LO documents the teacher attaches (they wait
 * in the inbox until the lesson exists, then move into `assets/`), chat attachments, pictures for the exporter
 * and files a plugin writes (`outputs/`). Access to one folder is serialised with the lesson's mutex.
 */
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { LoDocument } from '@shared/contracts/deck-builder'
import type { AttachmentRef, DocumentKind } from '@shared/contracts/deck-builder-chat'
import { fail, ok, type Result } from '@shared/result'
import { writeFileAtomic } from '../../export/save'
import { ASSET_EXTENSIONS, AssetStore, type AssetRecord } from './assets'
import { documentKindOf, numberedName, safeFileName } from './files'
import type { KeyedMutex } from './mutex'
import { isSafeId, type LessonPaths } from './paths'
import { LESSON_NOT_FOUND, type DialogPort } from './types'

const INBOX = '(inbox)'
const MAX_OUTPUT_NAMES = 99

/** An attached document with its bytes, wherever it is stored. */
export interface FoundDocument {
  record: AssetRecord
  bytes: Uint8Array
}

const asDocument = (record: AssetRecord): LoDocument | undefined =>
  record.kind === 'image'
    ? undefined
    : { id: record.id, name: record.name, kind: record.kind, sizeBytes: record.sizeBytes }

const asAttachment = (record: AssetRecord): AttachmentRef => ({
  id: record.id,
  name: record.name,
  kind: record.kind,
  sizeBytes: record.sizeBytes
})

export class LessonFiles {
  private readonly inbox: AssetStore

  constructor(
    private readonly paths: LessonPaths,
    private readonly deps: {
      mutex: KeyedMutex
      ids: (prefix: string) => string
      dialogs: DialogPort
    }
  ) {
    this.inbox = new AssetStore(paths.inbox, deps.ids)
  }

  private lessonAssets = (lessonId: string): AssetStore =>
    new AssetStore(this.paths.assets(lessonId), this.deps.ids)

  // ---- LO documents (before the lesson exists)

  /** Copies a dropped LO document into the inbox (Word, PDF or PowerPoint only). */
  async importLoDocument(path: string): Promise<Result<{ document: LoDocument }>> {
    const added = await this.deps.mutex.run(INBOX, () => this.inbox.addFile(path))
    if (!added.ok) return added
    const document = asDocument(added.asset)
    if (!document) {
      await this.deps.mutex.run(INBOX, () => this.inbox.remove(added.asset.id))
      return fail('invalid-input', 'Attach a Word, PDF or PowerPoint document.')
    }
    return ok({ document })
  }

  /** The Open dialog, then `importLoDocument`. */
  async pickLoDocument(): Promise<Result<{ document: LoDocument } | { cancelled: true }>> {
    const path = await this.deps.dialogs.pickOpenPath({
      title: 'Choose your learning objectives',
      extensions: ['docx', 'pdf', 'pptx']
    })
    return path ? this.importLoDocument(path) : ok({ cancelled: true as const })
  }

  /** Moves attached documents from the inbox into the new lesson's `assets/`. Unknown ids are ignored. */
  async adoptDocuments(lessonId: string, documentIds: readonly string[]): Promise<AttachmentRef[]> {
    const adopted: AttachmentRef[] = []
    for (const id of documentIds) {
      const record = await this.inbox.get(id)
      const moved = record
        ? await this.deps.mutex.run(lessonId, () =>
            this.inbox.moveTo(this.lessonAssets(lessonId), id)
          )
        : false
      if (record && moved) adopted.push(asAttachment(record))
    }
    return adopted
  }

  /** An attached document's record and bytes: from the inbox, else from the lesson's assets. */
  async findDocument(documentId: string, lessonId?: string): Promise<FoundDocument | undefined> {
    for (const store of [this.inbox, ...(lessonId ? [this.lessonAssets(lessonId)] : [])]) {
      const record = await store.get(documentId)
      const bytes = record ? await store.read(documentId) : undefined
      if (record && bytes) return { record, bytes }
    }
    return undefined
  }

  // ---- chat attachments and pictures (inside a lesson)

  /** Copies a file into the lesson's assets (the paperclip in chat). */
  async attach(lessonId: string, path: string): Promise<Result<{ attachment: AttachmentRef }>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const added = await this.deps.mutex.run(lessonId, () =>
      this.lessonAssets(lessonId).addFile(path)
    )
    return added.ok ? ok({ attachment: asAttachment(added.asset) }) : added
  }

  /** The Open dialog, then `attach`. */
  async pickAttachment(
    lessonId: string
  ): Promise<Result<{ attachment: AttachmentRef } | { cancelled: true }>> {
    const path = await this.deps.dialogs.pickOpenPath({
      title: 'Attach a file',
      extensions: ASSET_EXTENSIONS
    })
    return path ? this.attach(lessonId, path) : ok({ cancelled: true as const })
  }

  /** The attachment record for an id. */
  async attachment(lessonId: string, id: string): Promise<AttachmentRef | undefined> {
    if (!isSafeId(lessonId)) return undefined
    const record = await this.lessonAssets(lessonId).get(id)
    return record ? asAttachment(record) : undefined
  }

  /** Copy-on-use: puts a library picture into the lesson's `assets/` under its own id (a no-op when it is already there). */
  async copyLibraryPicture(
    lessonId: string,
    picture: { id: string; ext: string; title: string; bytes: Uint8Array }
  ): Promise<Result> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const copied = await this.deps.mutex.run(lessonId, () =>
      this.lessonAssets(lessonId).addBytesWithId(
        picture.id,
        picture.bytes,
        picture.ext,
        picture.title
      )
    )
    return copied.ok ? ok() : copied
  }

  /** The bytes of a lesson asset (a picture in the deck, an attachment). */
  readAsset(lessonId: string, assetId: string): Promise<Uint8Array | undefined> {
    return isSafeId(lessonId)
      ? this.lessonAssets(lessonId).read(assetId)
      : Promise.resolve(undefined)
  }

  /** `readAsset` bound to one lesson: what the exporter and the renderer ask for. */
  assetReader(lessonId: string): (assetId: string) => Promise<Uint8Array | undefined> {
    return (assetId) => this.readAsset(lessonId, assetId)
  }

  // ---- plugin outputs

  /**
   * Saves a file a plugin made into `lessons/<id>/outputs/` under a Windows-safe name (numbered when the name is
   * taken). Only Word, PDF and PowerPoint files are accepted.
   */
  async saveOutput(
    lessonId: string,
    name: string,
    bytes: Uint8Array
  ): Promise<Result<{ path: string; name: string; kind: DocumentKind }>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const kind = documentKindOf(name)
    if (!kind) return fail('invalid-input', 'Only Word, PDF and PowerPoint files can be saved.')
    return this.deps.mutex.run(lessonId, async () => {
      try {
        const dir = this.paths.outputs(lessonId)
        const base = safeFileName(name)
        let finalName = base
        for (let n = 2; n <= MAX_OUTPUT_NAMES && (await exists(join(dir, finalName))); n++)
          finalName = numberedName(base, n)
        const path = join(dir, finalName)
        await writeFileAtomic(path, bytes)
        return ok({ path, name: finalName, kind })
      } catch (error) {
        return fail(
          'io',
          `The file could not be saved: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
