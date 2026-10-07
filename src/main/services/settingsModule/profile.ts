/** Profile rules (design/screens/01-welcome.md §6): name 1–40 characters, subject 0–60, both trimmed. */
import { fail, ok, type Failure, type Result } from '@shared/result'

export const NAME_MAX = 40
export const SUBJECT_MAX = 60

export const NAME_REQUIRED = 'Add your name so I know what to call you.'
export const NAME_TOO_LONG = `Use ${NAME_MAX} characters or fewer for your name.`
export const SUBJECT_TOO_LONG = `Use ${SUBJECT_MAX} characters or fewer for what you teach.`

/** What gets saved: the settings file keeps '' for "not set". */
export interface ProfileChange {
  name?: string
  subject?: string
}

/** Validates and normalises a `setProfile` patch coming from the renderer (untrusted). */
export function validateProfilePatch(patch: unknown): Result<{ change: ProfileChange }> {
  if (typeof patch !== 'object' || patch === null) return invalid('Couldn’t save that. Try again.')
  const { name, subject } = patch as { name?: unknown; subject?: unknown }
  const change: ProfileChange = {}
  if (name !== undefined) {
    if (typeof name !== 'string') return invalid(NAME_REQUIRED)
    const trimmed = name.trim()
    if (trimmed.length === 0) return invalid(NAME_REQUIRED)
    if (trimmed.length > NAME_MAX) return invalid(NAME_TOO_LONG)
    change.name = trimmed
  }
  if (subject !== undefined && subject !== null) {
    if (typeof subject !== 'string') return invalid(SUBJECT_TOO_LONG)
    const trimmed = subject.trim()
    if (trimmed.length > SUBJECT_MAX) return invalid(SUBJECT_TOO_LONG)
    change.subject = trimmed
  }
  if (subject === null) change.subject = ''
  return ok({ change })
}

const invalid = (message: string): Failure => fail('invalid-input', message)
