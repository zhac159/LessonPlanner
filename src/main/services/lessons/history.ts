/**
 * `LessonHistory`: a `DeckHistory` that also knows WHICH change sits on top of each stack, which the editor needs
 * for Undo/Redo labels and the ResultChip rule "Undo only while that change is the latest" (06 §8.6).
 * `DeckHistory` keeps its stacks private, so this mirrors them from the same journal lines.
 */
import type { HistoryState } from '@shared/contracts/deck-builder'
import {
  DeckHistory,
  type HistoryEntry,
  type HistoryOptions,
  type StepResult
} from '@shared/deck/history'
import { changeSetSchema } from '@shared/deck/schema'
import type { ChangeSet, Deck } from '@shared/deck/types'

const LIMIT = 200

/** Mirrors the stacks from journal lines with the same tolerance as `DeckHistory.fromJournal`. */
function mirrorJournal(lines: readonly string[]): { undo: ChangeSet[]; redo: ChangeSet[] } {
  const undo: ChangeSet[] = []
  const redo: ChangeSet[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    let json: { kind?: unknown; changeSet?: unknown; patches?: unknown; inversePatches?: unknown }
    try {
      json = JSON.parse(line)
    } catch {
      continue
    }
    if (json.kind === 'change') {
      const parsed = changeSetSchema.safeParse(json.changeSet)
      if (!parsed.success || !Array.isArray(json.patches) || !Array.isArray(json.inversePatches))
        continue
      undo.push(parsed.data)
      if (undo.length > LIMIT) undo.shift()
      redo.length = 0
    } else if (json.kind === 'undo') {
      const moved = undo.pop()
      if (moved) redo.push(moved)
    } else if (json.kind === 'redo') {
      const moved = redo.pop()
      if (moved) undo.push(moved)
    }
  }
  return { undo, redo }
}

export class LessonHistory {
  private constructor(
    private readonly history: DeckHistory,
    private undoStack: ChangeSet[],
    private redoStack: ChangeSet[]
  ) {}

  /** Rebuilds both stacks from `changes.jsonl` lines (undo and redo survive restarts). */
  static fromJournal(lines: readonly string[], options: HistoryOptions = {}): LessonHistory {
    const { history } = DeckHistory.fromJournal(lines, { ...options, limit: LIMIT })
    const { undo, redo } = mirrorJournal(lines)
    return new LessonHistory(history, undo, redo)
  }

  /** Records a new change; clears redo. */
  record(entry: HistoryEntry): void {
    this.history.record(entry)
    this.undoStack.push(entry.changeSet)
    if (this.undoStack.length > LIMIT) this.undoStack.shift()
    this.redoStack = []
  }

  undo(deck: Deck): StepResult {
    const result = this.history.undo(deck)
    if (result.ok) this.redoStack.push(this.undoStack.pop() as ChangeSet)
    return result
  }

  redo(deck: Deck): StepResult {
    const result = this.history.redo(deck)
    if (result.ok) this.undoStack.push(this.redoStack.pop() as ChangeSet)
    return result
  }

  /** The change an Undo would revert. */
  get nextUndo(): ChangeSet | undefined {
    return this.undoStack.at(-1)
  }

  /** The change a Redo would re-apply. */
  get nextRedo(): ChangeSet | undefined {
    return this.redoStack.at(-1)
  }

  /** What the editor needs to enable and label Undo and Redo. */
  state(): HistoryState {
    const undo = this.nextUndo
    const redo = this.nextRedo
    return {
      canUndo: undo !== undefined,
      canRedo: redo !== undefined,
      undoChangeSetId: undo?.id ?? null,
      redoChangeSetId: redo?.id ?? null,
      ...(undo ? { undoSummary: undo.summary } : {}),
      ...(redo ? { redoSummary: redo.summary } : {})
    }
  }

  /** A change still in the history: `undone` is true while it sits on the redo stack. */
  find(changeSetId: string): { changeSet: ChangeSet; undone: boolean } | undefined {
    const applied = this.undoStack.find((c) => c.id === changeSetId)
    if (applied) return { changeSet: applied, undone: false }
    const undone = this.redoStack.find((c) => c.id === changeSetId)
    return undone ? { changeSet: undone, undone: true } : undefined
  }
}
