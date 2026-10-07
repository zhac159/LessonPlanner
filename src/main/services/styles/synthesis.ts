/** Folding Claude's synthesis result into a style, keeping everything the app owns. */
import type { Slide } from '@shared/deck/types'
import { safeParseStyleProfile } from '@shared/style/schema'
import type { StyleProfile } from '@shared/style/types'
import type { StyleState } from './types'

const MAX_NAME = 40

/**
 * Merges the synthesised profile into `state`. The app owns identity, default flag, sources, corrections and
 * timestamps; the name is only taken from Claude while it is still the auto-generated one.
 * Returns an error string (state untouched) when the profile does not validate.
 */
export function applySynthesis(
  state: StyleState,
  synthesised: StyleProfile,
  testSlide: Slide | null,
  now: string
): { ok: true; name: string | null } | { ok: false; error: string } {
  const parsed = safeParseStyleProfile(synthesised)
  if (!parsed.ok) return { ok: false, error: parsed.error }
  const current = state.profile
  const suggested = parsed.profile.name.trim().slice(0, MAX_NAME)
  const renamed = state.meta.nameSource === 'auto' && suggested !== '' && suggested !== current.name
  state.profile = {
    ...parsed.profile,
    id: current.id,
    isDefault: current.isDefault,
    status: current.status,
    sources: current.sources,
    corrections: current.corrections,
    // picture habits are built locally, never by Claude: the synthesis keeps what the picture step made
    ...(current.pictures ? { pictures: current.pictures } : {}),
    createdAt: current.createdAt,
    name: renamed ? suggested : current.name,
    version: current.version + 1,
    updatedAt: now
  }
  state.meta.testSlide = testSlide
  state.meta.synthesised = true
  state.meta.hasSynthesis = true
  return { ok: true, name: renamed ? suggested : null }
}
