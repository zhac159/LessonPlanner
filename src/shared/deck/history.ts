/**
 * Undo/redo for a deck (design/deck-model.md §3 "Undo / redo"), persistable across restarts.
 *
 * Each applied ChangeSet becomes a `HistoryEntry` (the ChangeSet plus immer patches both ways). The journal
 * (`changes.jsonl`) is append-only: one JSON line per event.
 *   {"v":1,"kind":"change","changeSet":{…},"patches":[…],"inversePatches":[…]}
 *   {"v":1,"kind":"undo"}   {"v":1,"kind":"redo"}
 * `DeckHistory.fromJournal` replays the lines to rebuild both stacks, so redo also survives a restart.
 * The services layer owns the file; this module is pure (strings in, strings out).
 */
import { applyPatches, enablePatches, produce, type Patch } from 'immer'
import { z } from 'zod'
import { applyChangeSet, type ApplyOptions } from './apply'
import { changeSetSchema } from './schema'
import type { ChangeSet, Deck } from './types'

enablePatches()

export interface HistoryEntry {
  changeSet: ChangeSet
  patches: Patch[]
  inversePatches: Patch[]
}

export interface HistoryOptions {
  /** Clock for `updatedAt` after an undo/redo. Default `new Date()`. */
  clock?: () => Date
  /** Maximum undo steps kept in memory (oldest dropped). Default 200. */
  limit?: number
}

export type StepResult =
  { ok: true; deck: Deck; entry: HistoryEntry } | { ok: false; error: string }

// ---- journal lines ----------------------------------------------------------------------------

const patchSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.array(z.union([z.string(), z.number()])),
  value: z.unknown().optional()
})

const journalLineSchema = z.discriminatedUnion('kind', [
  z.object({
    v: z.literal(1),
    kind: z.literal('change'),
    changeSet: changeSetSchema,
    patches: z.array(patchSchema),
    inversePatches: z.array(patchSchema)
  }),
  z.object({ v: z.literal(1), kind: z.literal('undo') }),
  z.object({ v: z.literal(1), kind: z.literal('redo') })
])

/** The `changes.jsonl` line (no trailing newline) that records an applied change. */
export const changeLine = (entry: HistoryEntry): string =>
  JSON.stringify({ v: 1, kind: 'change', ...entry })
/** The journal line that records an undo. */
export const UNDO_LINE = JSON.stringify({ v: 1, kind: 'undo' })
/** The journal line that records a redo. */
export const REDO_LINE = JSON.stringify({ v: 1, kind: 'redo' })

// ---- history ----------------------------------------------------------------------------------

export class DeckHistory {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private readonly clock: () => Date
  private readonly limit: number

  constructor(options: HistoryOptions = {}) {
    this.clock = options.clock ?? (() => new Date())
    this.limit = options.limit ?? 200
  }

  /**
   * Rebuilds a history by replaying journal lines. Blank lines are ignored; malformed lines, and
   * undo/redo markers that have nothing to act on, are skipped and counted so callers can warn.
   */
  static fromJournal(lines: readonly string[], options: HistoryOptions = {}) {
    const history = new DeckHistory(options)
    let skipped = 0
    for (const line of lines) {
      if (!line.trim()) continue
      let json: unknown
      try {
        json = JSON.parse(line)
      } catch {
        skipped++
        continue
      }
      const parsed = journalLineSchema.safeParse(json)
      if (!parsed.success) {
        skipped++
      } else if (parsed.data.kind === 'change') {
        const { changeSet, patches, inversePatches } = parsed.data
        history.record({
          changeSet,
          patches: patches as Patch[],
          inversePatches: inversePatches as Patch[]
        })
      } else if (!history.replayMarker(parsed.data.kind)) {
        skipped++
      }
    }
    return { history, skipped }
  }

  /** Records a new change; the redo stack is cleared (design/deck-model.md §3). */
  record(entry: HistoryEntry): void {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    this.redoStack = []
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Summary of the change an undo would revert ("Replaced the photo on slide 3…"), for menu labels. */
  get nextUndoSummary(): string | null {
    return this.undoStack.at(-1)?.changeSet.summary ?? null
  }

  get nextRedoSummary(): string | null {
    return this.redoStack.at(-1)?.changeSet.summary ?? null
  }

  /** Reverts the latest change on `deck`. The caller appends `UNDO_LINE` to the journal on success. */
  undo(deck: Deck): StepResult {
    const entry = this.undoStack.at(-1)
    if (!entry) return { ok: false, error: 'Nothing to undo' }
    const result = this.step(deck, entry.inversePatches, entry)
    if (result.ok) this.redoStack.push(this.undoStack.pop() as HistoryEntry)
    return result
  }

  /** Re-applies the latest undone change. The caller appends `REDO_LINE` on success. */
  redo(deck: Deck): StepResult {
    const entry = this.redoStack.at(-1)
    if (!entry) return { ok: false, error: 'Nothing to redo' }
    const result = this.step(deck, entry.patches, entry)
    if (result.ok) this.undoStack.push(this.redoStack.pop() as HistoryEntry)
    return result
  }

  private replayMarker(kind: 'undo' | 'redo'): boolean {
    const [from, to] =
      kind === 'undo' ? [this.undoStack, this.redoStack] : [this.redoStack, this.undoStack]
    const entry = from.pop()
    if (entry) to.push(entry)
    return entry !== undefined
  }

  private step(deck: Deck, patches: Patch[], entry: HistoryEntry): StepResult {
    try {
      const next = produce(applyPatches(deck, patches), (draft) => {
        draft.updatedAt = this.clock().toISOString()
      })
      return { ok: true, deck: next, entry }
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error)
      return { ok: false, error: `The history no longer matches the deck: ${why}` }
    }
  }
}

// ---- grouping ---------------------------------------------------------------------------------

/**
 * Merges consecutive entries into ONE entry, so a whole AI generation (many ChangeSets) is a single
 * undo step. `entries` must be in the order they were applied; the group's inverse patches replay the
 * individual inverses newest-first.
 */
export function groupChangeSets(
  entries: readonly HistoryEntry[],
  meta: { id: string; summary: string; at?: string }
): HistoryEntry {
  if (entries.length === 0) throw new Error('groupChangeSets needs at least one entry')
  const first = entries[0].changeSet
  const changeSet: ChangeSet = {
    id: meta.id,
    by: first.by,
    ...(first.pluginId ? { pluginId: first.pluginId } : {}),
    summary: meta.summary,
    ops: entries.flatMap((e) => e.changeSet.ops),
    at: meta.at ?? entries[entries.length - 1].changeSet.at
  }
  return {
    changeSet,
    patches: entries.flatMap((e) => e.patches),
    inversePatches: entries.toReversed().flatMap((e) => e.inversePatches)
  }
}

export type GroupApplyResult =
  | { ok: true; deck: Deck; entry: HistoryEntry }
  | { ok: false; errors: string[]; failedIndex: number }

/**
 * Applies several ChangeSets in order and returns the final deck plus ONE grouped history entry. All or
 * nothing: if any ChangeSet is rejected the input deck is untouched and `failedIndex` says which one.
 */
export function applyChangeSetsGrouped(
  deck: Deck,
  changeSets: readonly ChangeSet[],
  meta: { id: string; summary: string; at?: string },
  options?: ApplyOptions
): GroupApplyResult {
  const entries: HistoryEntry[] = []
  let current = deck
  for (const [failedIndex, changeSet] of changeSets.entries()) {
    const result = applyChangeSet(current, changeSet, options)
    if (!result.ok) return { ok: false, errors: result.errors, failedIndex }
    entries.push({
      changeSet: result.changeSet,
      patches: result.patches,
      inversePatches: result.inversePatches
    })
    current = result.deck
  }
  if (entries.length === 0)
    return { ok: false, errors: ['No change sets to apply'], failedIndex: 0 }
  return { ok: true, deck: current, entry: groupChangeSets(entries, meta) }
}
