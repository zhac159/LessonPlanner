/** Pure merge of a `progress` event into the screen's StyleDraftView (04 §8: main pushes, the UI never polls). */
import type { StyleDraftView, StyleLibraryEvents } from '@shared/contracts/style-library'

export type ProgressEvent = StyleLibraryEvents['progress']

/**
 * The view after `event`: the changed file is updated or appended, `progress` replaced, the profile
 * replaced when the event carries one (and cleared when nothing is learned any more), and a suggested
 * name taken only while it is still automatic. Events for another style leave the view as it is.
 */
export function applyProgress(view: StyleDraftView, event: ProgressEvent): StyleDraftView {
  if (event.styleId !== view.id) return view
  const files = event.file ? upsert(view.files, event.file) : view.files
  const profile = event.partialProfile ?? (event.progress.learned === 0 ? null : view.profile)
  const name = event.name && view.nameSource === 'auto' ? event.name : view.name
  return { ...view, files, progress: event.progress, profile, name }
}

function upsert(files: StyleDraftView['files'], file: StyleDraftView['files'][number]) {
  const index = files.findIndex((candidate) => candidate.id === file.id)
  if (index < 0) return [...files, file]
  return files.map((candidate, i) => (i === index ? file : candidate))
}

/**
 * True when the event stream and the file list disagree (a file was removed or restored, which has no
 * per-file event): the screen then asks main for the whole view again.
 */
export function needsReload(view: StyleDraftView): boolean {
  return view.files.length !== view.progress.total
}
