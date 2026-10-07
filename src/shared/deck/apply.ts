/**
 * Applying a ChangeSet to a Deck (design/deck-model.md §3). The ONLY way a deck changes.
 *
 * validate (schema) -> apply every op on an immer draft (collect ALL errors) -> normalise -> bump
 * `updatedAt` -> return the new deck with forward and inverse patches (undo = apply the inverse patches).
 * Any error rejects the whole ChangeSet: the input deck is never partially changed.
 */
import { enablePatches, produceWithPatches, type Patch } from 'immer'
import { applyOp } from './applyOps'
import { normaliseDeckInPlace } from './normalise'
import { changeSetSchema, formatIssues } from './schema'
import type { ChangeSet, Deck } from './types'

enablePatches()

export interface ApplyOptions {
  /**
   * Let ops move/remove locked elements. Default false: the AI may only touch them when the teacher's
   * message explicitly asked for it, so callers set this deliberately.
   */
  allowLocked?: boolean
  /** Clock for `updatedAt` (inject a fixed one in tests). Default: `new Date()`. */
  clock?: () => Date
}

export type ApplyResult =
  | { ok: true; deck: Deck; changeSet: ChangeSet; patches: Patch[]; inversePatches: Patch[] }
  | { ok: false; errors: string[] }

/**
 * Applies `changeSet` to `deck`. On success the returned deck is a new (frozen) object and
 * `inversePatches` undo exactly this change, including the `updatedAt` bump. `changeSet` is the validated
 * input with generated ids filled in: record THAT in the history, not the raw input.
 */
export function applyChangeSet(
  deck: Deck,
  changeSet: ChangeSet,
  options: ApplyOptions = {}
): ApplyResult {
  const parsed = changeSetSchema.safeParse(changeSet)
  if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) }
  const { ops } = parsed.data
  if (ops.length === 0) return { ok: false, errors: ['The change set has no operations'] }

  const errors: string[] = []
  const ctx = { allowLocked: options.allowLocked ?? false }
  const [next, patches, inversePatches] = produceWithPatches(deck, (draft) => {
    ops.forEach((op, i) => {
      const problem = applyOp(draft, op, ctx)
      if (problem) errors.push(`ops[${i}] (${op.op}): ${problem}`)
    })
    if (errors.length) return
    normaliseDeckInPlace(draft)
    draft.updatedAt = (options.clock ?? (() => new Date()))().toISOString()
  })
  return errors.length
    ? { ok: false, errors }
    : { ok: true, deck: next, changeSet: parsed.data, patches, inversePatches }
}
