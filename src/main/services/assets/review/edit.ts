/** `review:edit`: what she may change on a candidate, checked against the naming rules and the names in use. */
import { checkAssetName } from '@shared/assets/names'
import { ASSET_KINDS } from '@shared/assets/types'
import type { ReviewEdit } from '@shared/contracts/assets'
import { fail, type Failure } from '@shared/result'
import { cleanDescription, cleanTitle } from '../library'
import type { EditableField, StoredCandidate } from './types'

/** Applies `edit` to `candidate` in place; returns the refusal (and changes nothing more) when a field is not allowed. */
export function applyEdit(
  candidate: StoredCandidate,
  edit: ReviewEdit,
  taken: Iterable<string>
): Failure | null {
  const touch = (field: EditableField): void => {
    if (!candidate.edited.includes(field)) candidate.edited.push(field)
  }
  if (edit.name !== undefined) {
    const check = checkAssetName(edit.name, taken)
    if (!check.ok) return fail('invalid-input', check.message)
    candidate.name = check.name
    touch('name')
  }
  if (edit.kind !== undefined) {
    if (!ASSET_KINDS.includes(edit.kind)) {
      return fail('invalid-input', 'That kind of picture is not known.')
    }
    candidate.kind = edit.kind
    touch('kind')
  }
  if (edit.title !== undefined) {
    candidate.title = cleanTitle(edit.title, candidate.name)
    touch('title')
  }
  if (edit.description !== undefined) {
    candidate.description = cleanDescription(edit.description)
    touch('description')
  }
  if (edit.keep !== undefined) {
    if (edit.keep && candidate.duplicateOf) {
      return fail('invalid-input', 'That picture is already in Your assets.')
    }
    candidate.keep = edit.keep
  }
  return null
}
