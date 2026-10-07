/**
 * `LessonsService`: lessons on disk, as the `deck-builder` module needs them (design/deck-model.md §7,
 * screens 03, 05, 06). A plain class with injected dependencies (see `LessonsServiceDeps`); the module's
 * `main.ts` only maps IPC channels onto its methods.
 *
 *   lessons/<id>/{deck.json, changes.jsonl, chat.jsonl, lesson.json, thumb.png, assets/, outputs/}   index.json
 *
 * Editing (apply, undo, redo) lives in `LessonEditor`; files in `LessonFiles`; this class ties them together
 * and owns the lesson list (create, open, rename, duplicate, delete), export and thumbnails.
 */
import type { ExportResult, LessonSummary, StickyNote } from '@shared/contracts/deck-builder'
import type { ApplyOptions } from '@shared/deck/apply'
import type { ChangeSet, Deck } from '@shared/deck/types'
import { newId } from '@shared/ids'
import { fail, ok, type Result } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import {
  createLessonsPortFromDisk,
  type LessonAssetUse,
  type LessonsPort,
  type SlideContext
} from '../assets/usage'
import { blankSlide, cleanTitle, MAX_TITLE_LENGTH, newDeck, UNTITLED } from './blank'
import { DeleteQueue, DEFAULT_UNDO_WINDOW_MS } from './deleteQueue'
import { creditsOf } from './assetsPort'
import { LessonEditor, type ChangeInput, type Edited } from './editor'
import { LessonExports } from './exporter'
import { copyLesson } from './lessonCopy'
import { LessonFiles } from './lessonFiles'
import { LessonList } from './lessonList'
import { JobRegistry } from './jobs'
import { KeyedMutex } from './mutex'
import { isSafeId, LessonPaths } from './paths'
import { LessonStore, type Sidecar } from './store'
import { entryOf, SummaryIndex, type LessonListItem } from './summary'
import { ThumbnailService } from './thumbnails'
import {
  LESSON_NOT_FOUND,
  silentLogger,
  type GenerationRecord,
  type LessonsServiceDeps,
  type Logger,
  type NewLesson,
  type OpenedLesson
} from './types'

export class LessonsService {
  /** Running AI jobs; one per lesson. */
  readonly jobs: JobRegistry
  /** Attached documents, chat attachments, pictures and plugin outputs. */
  readonly files: LessonFiles

  private readonly paths: LessonPaths
  private readonly store: LessonStore
  private readonly mutex = new KeyedMutex()
  private readonly editor: LessonEditor
  private readonly index: SummaryIndex
  private readonly listing: LessonList
  private readonly thumbs: ThumbnailService
  private readonly deletes: DeleteQueue
  private readonly exports: LessonExports
  private readonly usage: LessonsPort
  private readonly clock: () => Date
  private readonly ids: (prefix: string) => string
  private readonly log: Logger

  constructor(private readonly deps: LessonsServiceDeps) {
    this.clock = deps.clock ?? (() => new Date())
    this.ids = deps.ids ?? newId
    this.log = deps.log ?? silentLogger
    this.paths = new LessonPaths(deps.dir)
    this.store = new LessonStore(this.paths)
    this.index = new SummaryIndex(this.paths, this.store, this.clock)
    this.jobs = new JobRegistry(this.ids)
    this.listing = new LessonList({
      index: this.index,
      store: this.store,
      jobs: this.jobs,
      emit: deps.emit,
      log: this.log
    })
    this.exports = new LessonExports()
    this.usage = createLessonsPortFromDisk(deps.dir)
    this.files = new LessonFiles(this.paths, {
      mutex: this.mutex,
      ids: this.ids,
      dialogs: deps.dialogs
    })
    this.thumbs = new ThumbnailService({
      store: this.store,
      renderer: deps.renderer,
      log: this.log,
      onUpdated: () => void this.listing.notify()
    })
    this.deletes = new DeleteQueue(this.paths, {
      trash: deps.trash,
      windowMs: deps.undoWindowMs ?? DEFAULT_UNDO_WINDOW_MS,
      log: this.log
    })
    this.editor = new LessonEditor({
      store: this.store,
      mutex: this.mutex,
      clock: this.clock,
      ids: this.ids,
      log: this.log,
      onCommitted: (lessonId, deck) => this.afterCommit(lessonId, deck)
    })
  }

  /** Where a lesson's `chat.jsonl` lives (the chat store appends to it). */
  chatPath(lessonId: string): string {
    if (!isSafeId(lessonId)) throw new Error(`Not a lesson id: ${String(lessonId)}`)
    return this.paths.chat(lessonId)
  }

  // ---- the list

  /** All lessons, most recently changed first. Lessons whose files are damaged are marked `damaged`. */
  list(): Promise<LessonListItem[]> {
    return this.listing.list()
  }

  /** One lesson's list row. */
  summaryOf(lessonId: string): Promise<LessonSummary | undefined> {
    return this.listing.summaryOf(lessonId)
  }

  /** Sends `lessonsChanged` with the current list (no-op without an `emit`). */
  notifyChanged(): Promise<void> {
    return this.listing.notify()
  }

  // ---- create, open

  /** Creates a lesson (optionally with one blank slide). */
  async create(input: NewLesson): Promise<Result<{ lessonId: string; lesson: LessonSummary }>> {
    const style = await this.styleById(input.styleId)
    if (input.styleId && !style) return fail('not-found', 'That style can’t be found.')
    const typed = input.title?.trim() ? cleanTitle(input.title) : null
    if (input.title?.trim() && !typed)
      return fail('invalid-input', `Titles can be up to ${MAX_TITLE_LENGTH} characters.`)
    const lessonId = this.ids('les')
    const deck = newDeck({
      id: lessonId,
      title: typed ?? UNTITLED,
      meta: input.meta,
      style: style ?? null,
      now: this.clock()
    })
    if (input.blankSlide) deck.slides = [blankSlide(this.ids('sld'), style ?? null)]
    try {
      await this.mutex.run(lessonId, async () => {
        await this.store.writeDeck(lessonId, deck)
        await this.store.writeSidecar(lessonId, {
          titleSource: typed ? 'user' : 'auto',
          stickyNotes: []
        })
      })
    } catch (error) {
      return fail('io', `The lesson could not be saved: ${String(error)}`)
    }
    await this.afterCommit(lessonId, deck)
    return ok({ lessonId, lesson: (await this.summaryOf(lessonId))! })
  }

  /** Everything the editor needs about a lesson except its chat and style (those come from other services). */
  async open(lessonId: string): Promise<Result<OpenedLesson>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const read = await this.editor.read(lessonId)
    if (!read.ok) {
      if (read.code === 'io') await this.listing.markDamaged(lessonId)
      return read
    }
    const sidecar = await this.store.readSidecar(lessonId)
    const job = this.jobs.running(lessonId)
    return ok({
      deck: read.deck,
      titleSource: sidecar.titleSource,
      history: read.history,
      stickyNotes: sidecar.stickyNotes,
      runningJob: job ? { jobId: job.id, kind: job.kind, messageId: job.messageId } : null
    })
  }

  /** The current deck and its style profile (null for the plain style): what a job works from. */
  async context(lessonId: string): Promise<Result<{ deck: Deck; style: StyleProfile | null }>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const read = await this.editor.read(lessonId)
    if (!read.ok) return read
    return ok({ deck: read.deck, style: (await this.styleById(read.deck.styleId)) ?? null })
  }

  /** The style profile with this id, or undefined (null id means the plain style). */
  async styleById(styleId: string | null): Promise<StyleProfile | undefined> {
    return styleId ? this.deps.styles.getProfile(styleId) : undefined
  }

  // ---- rename, duplicate, delete

  /** Renames as one `setMeta` ChangeSet (one undo step); a title set by hand is never overwritten by Claude. */
  async rename(lessonId: string, title: string): Promise<Result<{ lesson: LessonSummary }>> {
    const clean = cleanTitle(title)
    if (!clean) return fail('invalid-input', `Titles are 1 to ${MAX_TITLE_LENGTH} characters.`)
    const edited = await this.apply(lessonId, {
      by: 'user',
      summary: `Renamed the lesson to “${clean}”`,
      ops: [{ op: 'setMeta', title: clean }]
    })
    if (!edited.ok) return edited
    await this.updateSidecar(lessonId, (s) => ({ ...s, titleSource: 'user' }))
    return ok({ lesson: (await this.summaryOf(lessonId))! })
  }

  /** A copy with a new id, the same slides and pictures, and a fresh history and chat. */
  async duplicate(lessonId: string): Promise<Result<{ lesson: LessonSummary }>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const copyId = this.ids('les')
    const copied = await copyLesson(
      { store: this.store, mutex: this.mutex, clock: this.clock },
      lessonId,
      copyId
    )
    if (!copied.ok) return copied
    const deck = await this.store.readDeck(copyId)
    if (deck.ok) await this.afterCommit(copyId, deck.deck)
    return ok({ lesson: (await this.summaryOf(copyId))! })
  }

  /**
   * Removes a lesson from Home at once; for the undo window (default 10 s) `undoDelete` brings it back, after
   * which the folder goes to the Recycle Bin. A lesson with a running AI job cannot be deleted.
   */
  async delete(lessonId: string): Promise<Result> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    if (this.jobs.running(lessonId))
      return fail(
        'invalid-input',
        'Wait for Claude to finish, or press Stop, before deleting this lesson.'
      )
    await this.thumbs.flush()
    const staged = await this.mutex.run(lessonId, async (): Promise<Result> => {
      if (!(await this.store.exists(lessonId))) return fail('not-found', LESSON_NOT_FOUND)
      this.editor.evict(lessonId)
      try {
        await this.deletes.stage(lessonId)
      } catch (error) {
        return fail('io', `The lesson could not be deleted: ${String(error)}`)
      }
      return ok()
    })
    if (!staged.ok) return staged
    await this.index.remove(lessonId)
    await this.notifyChanged()
    return ok()
  }

  /** Brings back a lesson deleted less than the undo window ago. */
  async undoDelete(lessonId: string): Promise<Result<{ lesson: LessonSummary }>> {
    if (!isSafeId(lessonId) || !(await this.deletes.restore(lessonId)))
      return fail('not-found', 'That lesson can no longer be restored.')
    const read = await this.store.readDeck(lessonId)
    if (read.ok) await this.index.upsert(entryOf(lessonId, read.deck))
    await this.notifyChanged()
    return ok({ lesson: (await this.summaryOf(lessonId))! })
  }

  /** Ends every undo window now (call at start-up and on quit). */
  finalizeDeletes(): Promise<void> {
    return this.deletes.finalizeAll()
  }

  // ---- editing

  /** One ChangeSet, one undo step. `by: 'user'` for direct edits, `'ai'` for chat, `'plugin'` for plugins. */
  apply(lessonId: string, input: ChangeInput, options?: ApplyOptions): Promise<Result<Edited>> {
    return this.editor.apply(lessonId, input, options)
  }

  /**
   * One ChangeSet worked out from the deck as it is when this edit's turn comes (inside the lesson's lock): what
   * placing a picture needs, so it never lands on a slide or element that changed a moment before.
   */
  applyFrom(
    lessonId: string,
    build: (deck: Deck) => Result<{ input: ChangeInput }>,
    options?: ApplyOptions
  ): Promise<Result<Edited>> {
    return this.editor.applyFrom(lessonId, build, options)
  }

  /** Several ChangeSets as ONE undo step (a whole generation). */
  applyGroup(
    lessonId: string,
    changeSets: readonly ChangeSet[],
    meta: { summary: string }
  ): Promise<Result<Edited>> {
    return this.editor.applyGroup(lessonId, changeSets, meta)
  }

  /** Undoes the latest change; with `expectedChangeSetId` only if that change is the latest. */
  undo(lessonId: string, expectedChangeSetId?: string): Promise<Result<Edited>> {
    return this.editor.undo(lessonId, expectedChangeSetId)
  }

  /** Redoes the latest undone change; with `expectedChangeSetId` only if that change is the next redo. */
  redo(lessonId: string, expectedChangeSetId?: string): Promise<Result<Edited>> {
    return this.editor.redo(lessonId, expectedChangeSetId)
  }

  /** The ChangeSets with these ids and whether each is currently undone (for chat's ResultChips). */
  async changes(
    lessonId: string,
    ids: readonly string[]
  ): Promise<Map<string, { changeSet: ChangeSet; undone: boolean }>> {
    const result = await this.editor.find(lessonId, ids)
    return result.ok ? result.found : new Map()
  }

  /** Replaces the lesson's sticky notes (private, never exported or sent to Claude). */
  async setStickyNotes(lessonId: string, notes: StickyNote[]): Promise<Result> {
    if (!isSafeId(lessonId) || !(await this.store.exists(lessonId)))
      return fail('not-found', LESSON_NOT_FOUND)
    const read = await this.editor.read(lessonId)
    if (!read.ok) return read
    const slides = new Set(read.deck.slides.map((s) => s.id))
    const kept = notes.filter((n) => slides.has(n.slideId))
    await this.updateSidecar(lessonId, (s) => ({ ...s, stickyNotes: kept }))
    return ok()
  }

  private async updateSidecar(
    lessonId: string,
    change: (sidecar: Sidecar) => Sidecar
  ): Promise<void> {
    await this.mutex.run(lessonId, async () => {
      await this.store.writeSidecar(lessonId, change(await this.store.readSidecar(lessonId)))
    })
  }

  // ---- generation record ("Finish the rest")

  getGenerationRecord(lessonId: string): Promise<GenerationRecord | undefined> {
    return isSafeId(lessonId) ? this.store.readGeneration(lessonId) : Promise.resolve(undefined)
  }

  /** Saves what is needed to finish a stopped generation, or clears it with null. */
  async setGenerationRecord(lessonId: string, record: GenerationRecord | null): Promise<void> {
    if (!isSafeId(lessonId)) return
    await (record
      ? this.store.writeGeneration(lessonId, record)
      : this.store.clearGeneration(lessonId))
  }

  // ---- export

  /**
   * Shows the Save dialog and writes the `.pptx`. While picture spots are empty it answers `spots` first and saves
   * nothing, unless `ignoreSpots` ("Export anyway"). Never throws.
   */
  async exportPptx(
    lessonId: string,
    options: { ignoreSpots?: boolean } = {}
  ): Promise<ExportResult> {
    const context = await this.context(lessonId)
    if (!context.ok) return { status: 'error', code: 'io', message: context.message }
    return this.exports.run({
      ...context,
      readAsset: this.files.assetReader(lessonId),
      dialogs: this.deps.dialogs,
      installedFonts: this.deps.installedFonts,
      assetCredits: creditsOf(context.deck, this.deps.assets),
      ignoreSpots: options.ignoreSpots === true
    })
  }

  // ---- "Used in" for the library

  /** Every lesson with the library pictures on each slide: how `Asset.usedIn` is rebuilt (agents/ASSETS.md §2.4). */
  lessonsUsingAssets(): Promise<LessonAssetUse[]> {
    return this.usage.lessonsUsingAssets()
  }

  /** The words of a slide and its picture spots, for "Suggested for this slide". */
  slideContext(lessonId: string, slideId: string): Promise<SlideContext | undefined> {
    return isSafeId(lessonId)
      ? this.usage.slideContext(lessonId, slideId)
      : Promise.resolve(undefined)
  }

  /** True for paths this session exported (the only ones `openExport` may open). */
  wasExported(path: string): boolean {
    return this.exports.wasExported(path)
  }

  // ---- after a change

  /** Resolves when pending thumbnails are drawn (tests, shutdown). */
  flushThumbnails(): Promise<void> {
    return this.thumbs.flush()
  }

  private async afterCommit(lessonId: string, deck: Deck): Promise<void> {
    await this.index.upsert(entryOf(lessonId, deck))
    this.deps.assets?.lessonsChanged()
    const style = (await this.styleById(deck.styleId)) ?? null
    this.thumbs.request({ lessonId, deck, style, readAsset: this.files.assetReader(lessonId) })
    await this.notifyChanged()
  }
}
