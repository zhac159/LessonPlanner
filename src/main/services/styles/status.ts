/** Lifecycle status of a style, derived from its files and whether a job is running. */
import type { StyleProfile } from '@shared/style/types'
import { countByStatus, pendingCount } from './views'
import type { StyleState } from './types'

/** Draft until saved; then learning while files are pending or a job runs; then ready (or failed if none read). */
export function deriveStatus(state: StyleState, jobActive: boolean): StyleProfile['status'] {
  if (!state.meta.saved) return 'draft'
  if (jobActive || pendingCount(state) > 0) return 'learning'
  if (countByStatus(state, 'learned') > 0) return 'ready'
  return state.profile.sources.length > 0 ? 'failed' : 'draft'
}
