/** Adding, removing, restoring and retrying a style's source files (04-create-style.md §8). */
import type { AddedFiles, RejectedFile as ContractRejected } from '@shared/contracts/style-library'
import { fail, ok, type Result } from '@shared/result'
import type { SourceRef } from '@shared/style/types'
import type { ImportFailureCode } from '../../import/errors'
import { validateFiles } from '../../import/validate'
import type { StyleCore } from './core'
import { refreshLocalProfile } from './localMerge'
import type { StyleState } from './types'

/** Removed files stay restorable (and on disk) for this long. */
const UNDO_KEEP_MS = 60 * 60 * 1000

const REJECTION: Partial<Record<ImportFailureCode, ContractRejected['reason']>> = {
  'old-ppt': 'old-ppt',
  'too-large': 'too-large',
  duplicate: 'duplicate',
  'too-many': 'limit'
}

const notFound = (what: string) => fail('not-found', `${what} not found`)

/** Validates, copies into the style's sources folder and queues the files as "waiting". */
export async function addFiles(
  core: StyleCore,
  state: StyleState,
  paths: string[]
): Promise<AddedFiles & { sources: SourceRef[] }> {
  await purgeExpiredRemovals(core, state)
  const existingHashes = new Set(
    Object.values(state.meta.files)
      .map((f) => f.hash)
      .filter(Boolean)
  )
  const { accepted, rejected } = await validateFiles(paths, {
    existingHashes,
    existingCount: state.profile.sources.length,
    ...core.limits
  })
  const sources: SourceRef[] = []
  for (const file of accepted) {
    const source: SourceRef = {
      id: core.ids('src'),
      fileName: file.fileName,
      kind: file.kind,
      pages: 0,
      status: 'waiting',
      addedAt: core.nowIso()
    }
    await core.store.copySource(state.profile.id, source, file.path)
    state.meta.files[source.id] = {
      fileName: file.fileName,
      kind: file.kind,
      addedAt: source.addedAt,
      hash: file.hash,
      mayContainNames: false
    }
    sources.push(source)
  }
  if (sources.length > 0) {
    await core.commit(state, () => {
      state.profile.sources.push(...sources)
      state.meta.synthesised = false
    })
  }
  return {
    added: sources.length,
    sources,
    rejected: rejected.map((r) => ({ name: r.fileName, reason: REJECTION[r.code] ?? 'type' }))
  }
}

/**
 * Removes a file. Learned files drop out of the vote at once; the analysis stays on disk for Undo.
 * Returns whether Claude's synthesis should be re-run (debounced by the caller).
 */
export async function removeFile(
  core: StyleCore,
  state: StyleState,
  fileId: string
): Promise<Result<{ undoToken: string; resynthesise: boolean }>> {
  let resynthesise = false
  let missing = false
  core.jobs.get(state.profile.id)?.cancelFile(fileId)
  await core.commit(state, () => {
    const index = state.profile.sources.findIndex((s) => s.id === fileId)
    if (index < 0) {
      missing = true
      return
    }
    const [source] = state.profile.sources.splice(index, 1)
    state.meta.removed[fileId] = {
      source: { ...source },
      file: state.meta.files[fileId],
      at: core.nowIso()
    }
    delete state.meta.files[fileId]
    if (source.status === 'learned') {
      state.analyses.delete(fileId)
      resynthesise = state.meta.hasSynthesis && state.analyses.size > 0
      state.meta.synthesised = false
      refreshLocalProfile(state)
    }
  })
  if (missing) return notFound('File')
  await core.refreshPictures(state, true) // her picture habits follow the files that are left
  return ok({ undoToken: fileId, resynthesise })
}

/** Undo of `removeFile`: brings the file back with its cached analysis (no new Claude call). */
export async function restoreFile(
  core: StyleCore,
  state: StyleState,
  fileId: string
): Promise<Result<{ learned: boolean }>> {
  const removed = state.meta.removed[fileId]
  if (!removed) return notFound('Removed file')
  const analysis =
    removed.source.status === 'learned'
      ? await core.store.readAnalysis(state.profile.id, fileId)
      : undefined
  await core.commit(state, () => {
    const source: SourceRef = { ...removed.source, status: analysis ? 'learned' : 'waiting' }
    state.profile.sources.push(source)
    state.meta.files[fileId] = removed.file
    delete state.meta.removed[fileId]
    if (analysis) {
      state.analyses.set(fileId, analysis)
      state.meta.synthesised = false
      refreshLocalProfile(state)
    }
  })
  await core.refreshPictures(state, true)
  return ok({ learned: Boolean(analysis) })
}

/** Puts a failed file back in the queue. */
export async function retryFile(
  core: StyleCore,
  state: StyleState,
  fileId: string
): Promise<Result> {
  let found = false
  await core.commit(state, () => {
    const source = state.profile.sources.find((s) => s.id === fileId && s.status === 'failed')
    if (!source) return
    found = true
    source.status = 'waiting'
    delete source.error
    delete state.meta.files[fileId]?.error
  })
  return found ? ok() : notFound('Failed file')
}

/** "Carry on": clears the pause and requeues files that only failed because Claude was unreachable. */
export async function clearPause(core: StyleCore, state: StyleState): Promise<void> {
  await core.commit(state, () => {
    state.meta.pausedFor = undefined
    for (const source of state.profile.sources) {
      const meta = state.meta.files[source.id]
      if (source.status === 'failed' && meta?.error?.code === 'network') {
        source.status = 'waiting'
        delete source.error
        delete meta.error
      }
    }
  })
}

/** Deletes removed files that were not restored within the undo window. */
export async function purgeExpiredRemovals(core: StyleCore, state: StyleState): Promise<void> {
  const cutoff = core.nowMs() - UNDO_KEEP_MS
  const expired = Object.entries(state.meta.removed).filter(([, r]) => Date.parse(r.at) < cutoff)
  if (expired.length === 0) return
  for (const [, removed] of expired) await core.store.deleteSource(state.profile.id, removed.source)
  await core.commit(state, () => {
    for (const [id] of expired) delete state.meta.removed[id]
  })
}
