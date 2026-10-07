/** The local (no AI) merge: keeps the profile in step with the learned files between Claude syntheses. */
import { createDraftProfile } from '@shared/style/draft'
import { provisionalProfile } from '@shared/style/provisional'
import type { StyleProfile } from '@shared/style/types'
import { aggregateAnalyses, type LearnedSoFar } from '@shared/style/votes'
import type { StyleState } from './types'

/** Votes over the learned files, in queue order (so results never depend on completion order). */
export function learnedSoFar(state: StyleState): LearnedSoFar {
  const analyses = state.profile.sources.flatMap((s) => {
    const analysis = state.analyses.get(s.id)
    return s.status === 'learned' && analysis ? [analysis] : []
  })
  return aggregateAnalyses(analyses)
}

/** What the panel should show now: the current profile overlaid with the vote (display only). */
export function previewProfile(state: StyleState): StyleProfile {
  return provisionalProfile(state.profile, learnedSoFar(state))
}

/**
 * Before Claude has synthesised anything, the stored profile IS the local vote; with no learned files left it
 * goes back to the neutral draft. After a synthesis the stored profile is left alone until the next one.
 */
export function refreshLocalProfile(state: StyleState): void {
  if (state.meta.hasSynthesis) return
  const { profile } = state
  const hasLearned = state.analyses.size > 0
  const base = hasLearned
    ? profile
    : createDraftProfile(profile.id, profile.name, profile.createdAt)
  state.profile = {
    ...(hasLearned ? previewProfile(state) : base),
    id: profile.id,
    name: profile.name,
    version: profile.version,
    isDefault: profile.isDefault,
    status: profile.status,
    sources: profile.sources,
    corrections: profile.corrections,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  }
}
