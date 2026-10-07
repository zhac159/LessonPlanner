/**
 * `LessonEditor`: every change to a lesson's deck goes through here (design/deck-model.md §3).
 *
 * It keeps each opened lesson's Deck and history in memory, applies ChangeSets (validated by `applyChangeSet`),
 * journals them to `changes.jsonl`, and undoes/redoes them, also across restarts (the history is rebuilt from the
 * journal on first use). All work for one lesson is serialised, so a chat turn, a plugin and a direct edit never
 * interleave. The deck file is written BEFORE the journal line: a crash in between loses one undo step, never
 * leaves an undo step for a change that did not happen.
 */
import type { HistoryState } from '@shared/contracts/deck-builder'
import { applyChangeSet, type ApplyOptions } from '@shared/deck/apply'
import {
  REDO_LINE,
  UNDO_LINE,
  applyChangeSetsGrouped,
  changeLine,
  type HistoryEntry
} from '@shared/deck/history'
import type { ChangeSet, Deck, DeckOp } from '@shared/deck/types'
import { fail, ok, type Result } from '@shared/result'
import { LessonHistory } from './history'
import type { KeyedMutex } from './mutex'
import { isSafeId } from './paths'
import type { LessonStore } from './store'
import { LESSON_NOT_FOUND, type Logger } from './types'

/** What a caller supplies for one change; the editor adds the id and the time. */
export interface ChangeInput {
  by: ChangeSet['by']
  pluginId?: string
  summary: string
  ops: DeckOp[]
}

/** The outcome of a change, undo or redo: the new deck, the change and the history buttons' state. */
export interface Edited {
  deck: Deck
  changeSet: ChangeSet
  history: HistoryState
}

interface Loaded {
  deck: Deck
  history: LessonHistory
}

export interface EditorDeps {
  store: LessonStore
  mutex: KeyedMutex
  clock: () => Date
  ids: (prefix: string) => string
  log: Logger
  /** Called after a change reached the disk (updates the index and thumbnail). */
  onCommitted(lessonId: string, deck: Deck): Promise<void>
}

const ioFailure = (error: unknown) =>
  fail(
    'io',
    `The lesson could not be saved: ${error instanceof Error ? error.message : String(error)}`
  )

export class LessonEditor {
  private readonly cache = new Map<string, Loaded>()

  constructor(private readonly deps: EditorDeps) {}

  /** Forgets the in-memory copy (the next call reads the disk again). */
  evict(lessonId: string): void {
    this.cache.delete(lessonId)
  }

  private async load(lessonId: string): Promise<Result<{ loaded: Loaded }>> {
    if (!isSafeId(lessonId)) return fail('not-found', LESSON_NOT_FOUND)
    const cached = this.cache.get(lessonId)
    if (cached) return ok({ loaded: cached })
    const read = await this.deps.store.readDeck(lessonId)
    if (!read.ok) {
      return read.reason === 'missing'
        ? fail('not-found', LESSON_NOT_FOUND)
        : fail('io', 'This lesson can’t be opened because its file is damaged.')
    }
    const lines = await this.deps.store.readJournal(lessonId)
    const history = LessonHistory.fromJournal(lines, { clock: this.deps.clock })
    const loaded = { deck: read.deck, history }
    this.cache.set(lessonId, loaded)
    return ok({ loaded })
  }

  private exclusive<T extends object>(
    lessonId: string,
    work: (loaded: Loaded) => Promise<Result<T>>
  ): Promise<Result<T>> {
    return this.deps.mutex.run(lessonId, async () => {
      const result = await this.load(lessonId)
      return result.ok ? work(result.loaded) : result
    })
  }

  /** The current deck and history state. */
  read(lessonId: string): Promise<Result<{ deck: Deck; history: HistoryState }>> {
    return this.exclusive(lessonId, async ({ deck, history }) =>
      ok({ deck, history: history.state() })
    )
  }

  /** Looks up changes by id: the ChangeSet and whether it is currently undone. */
  find(
    lessonId: string,
    ids: readonly string[]
  ): Promise<Result<{ found: Map<string, { changeSet: ChangeSet; undone: boolean }> }>> {
    return this.exclusive(lessonId, async ({ history }) => {
      const found = new Map<string, { changeSet: ChangeSet; undone: boolean }>()
      for (const id of ids) {
        const hit = history.find(id)
        if (hit) found.set(id, hit)
      }
      return ok({ found })
    })
  }

  /** Applies one ChangeSet as one undo step. */
  apply(lessonId: string, input: ChangeInput, options: ApplyOptions = {}): Promise<Result<Edited>> {
    return this.applyFrom(lessonId, () => ok({ input }), options)
  }

  /**
   * Like `apply`, but the ops are worked out from the deck AS IT IS when this edit's turn comes (inside the
   * lesson's lock), so a placement never lands on a slide or element that changed a moment before.
   */
  applyFrom(
    lessonId: string,
    build: (deck: Deck) => Result<{ input: ChangeInput }>,
    options: ApplyOptions = {}
  ): Promise<Result<Edited>> {
    return this.exclusive(lessonId, async (loaded) => {
      const built = build(loaded.deck)
      if (!built.ok) return built
      const { input } = built
      const changeSet: ChangeSet = {
        id: this.deps.ids('chg'),
        by: input.by,
        ...(input.pluginId ? { pluginId: input.pluginId } : {}),
        summary: input.summary,
        ops: input.ops,
        at: this.deps.clock().toISOString()
      }
      const applied = applyChangeSet(loaded.deck, changeSet, { clock: this.deps.clock, ...options })
      if (!applied.ok) return fail('invalid-input', applied.errors.join('; '))
      const entry: HistoryEntry = {
        changeSet: applied.changeSet,
        patches: applied.patches,
        inversePatches: applied.inversePatches
      }
      return this.commit(lessonId, loaded, applied.deck, entry)
    })
  }

  /**
   * Applies several ChangeSets in order as ONE undo step (a whole generation). All or nothing; the group's
   * ChangeSet gets a fresh id and `summary`.
   */
  applyGroup(
    lessonId: string,
    changeSets: readonly ChangeSet[],
    meta: { summary: string },
    options: ApplyOptions = {}
  ): Promise<Result<Edited>> {
    return this.exclusive(lessonId, async (loaded) => {
      const at = this.deps.clock().toISOString()
      const grouped = applyChangeSetsGrouped(
        loaded.deck,
        changeSets,
        { id: this.deps.ids('chg'), summary: meta.summary, at },
        { clock: this.deps.clock, ...options }
      )
      if (!grouped.ok) return fail('invalid-input', grouped.errors.join('; '))
      return this.commit(lessonId, loaded, grouped.deck, grouped.entry)
    })
  }

  private async commit(
    lessonId: string,
    loaded: Loaded,
    deck: Deck,
    entry: HistoryEntry
  ): Promise<Result<Edited>> {
    try {
      await this.deps.store.writeDeck(lessonId, deck)
    } catch (error) {
      return ioFailure(error)
    }
    loaded.deck = deck
    try {
      await this.deps.store.appendJournal(lessonId, changeLine(entry))
      loaded.history.record(entry)
    } catch (error) {
      this.deps.log.warn(
        `Lesson ${lessonId}: the change was saved but not journaled: ${String(error)}`
      )
    }
    await this.committed(lessonId, deck)
    return ok({ deck, changeSet: entry.changeSet, history: loaded.history.state() })
  }

  /** Tells the owner a change reached the disk; a failure there never fails the edit. */
  private async committed(lessonId: string, deck: Deck): Promise<void> {
    try {
      await this.deps.onCommitted(lessonId, deck)
    } catch (error) {
      this.deps.log.warn(`Lesson ${lessonId}: updating the lesson list failed: ${String(error)}`)
    }
  }

  /** Undoes the latest change. With `expectedId`, only when that change is the latest. */
  undo(lessonId: string, expectedId?: string): Promise<Result<Edited>> {
    return this.step(lessonId, 'undo', expectedId)
  }

  /** Redoes the latest undone change. With `expectedId`, only when that change is the next redo. */
  redo(lessonId: string, expectedId?: string): Promise<Result<Edited>> {
    return this.step(lessonId, 'redo', expectedId)
  }

  private step(
    lessonId: string,
    direction: 'undo' | 'redo',
    expectedId: string | undefined
  ): Promise<Result<Edited>> {
    return this.exclusive(lessonId, async (loaded) => {
      const next = direction === 'undo' ? loaded.history.nextUndo : loaded.history.nextRedo
      if (!next)
        return fail('invalid-input', direction === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.')
      if (expectedId !== undefined && next.id !== expectedId)
        return fail(
          'invalid-input',
          direction === 'undo' ? 'Undo the later changes first.' : 'Redo the earlier changes first.'
        )
      const stepped =
        direction === 'undo' ? loaded.history.undo(loaded.deck) : loaded.history.redo(loaded.deck)
      if (!stepped.ok) {
        this.evict(lessonId)
        return fail('io', 'That change can no longer be undone because the lesson changed on disk.')
      }
      try {
        await this.deps.store.writeDeck(lessonId, stepped.deck)
        await this.deps.store.appendJournal(lessonId, direction === 'undo' ? UNDO_LINE : REDO_LINE)
      } catch (error) {
        this.evict(lessonId)
        return ioFailure(error)
      }
      loaded.deck = stepped.deck
      await this.committed(lessonId, stepped.deck)
      return ok({
        deck: stepped.deck,
        changeSet: stepped.entry.changeSet,
        history: loaded.history.state()
      })
    })
  }
}
