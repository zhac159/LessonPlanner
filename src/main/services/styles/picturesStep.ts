/**
 * The job's picture step, run once after the files are read (agents/ASSETS.md §5.1). For every learned file that has no
 * stored facts yet it (1) extracts the pictures locally, (2) groups what ALL those files found, (3) stores each file's facts
 * and its exemplars, (4) sends the candidates to the review queue as "Assets I found". Failure isolation: a file whose pictures
 * cannot be read still gets its slide facts (and its exemplars), and never stops the style; a missing queue only means no batch.
 * Resumable: files that already have facts are skipped, so a cancelled job carries on where it stopped.
 */
import type { FileAnalysis } from '@shared/ai/types'
import type { SourceRef } from '@shared/style/types'
import { buildFileExemplars } from './exemplars'
import { extractFile, groupAndFacts, pagePictures, type FileFindings } from './pictures'
import type { JobHost } from './learnJob'
import type { StyleState } from './types'

async function needsFacts(host: JobHost, state: StyleState, source: SourceRef): Promise<boolean> {
  const id = state.profile.id
  return (
    state.analyses.has(source.id) &&
    ((await host.store.readPictures(id, source.id)) === undefined ||
      (await host.store.readExemplars(id, source.id)) === undefined)
  )
}

async function findingsOf(
  host: JobHost,
  state: StyleState,
  source: SourceRef,
  analysis: FileAnalysis,
  signal: AbortSignal
): Promise<FileFindings> {
  const base = {
    sourceId: source.id,
    fileName: source.fileName,
    analysis,
    planPages: state.meta.files[source.id]?.sourcePlanPages ?? []
  }
  try {
    const read = await extractFile(
      host.extract,
      { path: host.store.sourcePath(state.profile.id, source), fileName: source.fileName },
      signal
    )
    return { ...base, units: read.units, images: read.images }
  } catch {
    return { ...base, units: source.pages, images: [] }
  }
}

export async function runPicturesStep(
  state: StyleState,
  host: JobHost,
  signal: AbortSignal
): Promise<void> {
  const styleId = state.profile.id
  const todo: SourceRef[] = []
  for (const source of state.profile.sources)
    if (source.status === 'learned' && (await needsFacts(host, state, source))) todo.push(source)
  if (todo.length === 0) return

  const files: FileFindings[] = []
  for (const source of todo) {
    if (signal.aborted) return
    files.push(await findingsOf(host, state, source, state.analyses.get(source.id)!, signal))
  }
  if (signal.aborted) return

  const grouped = groupAndFacts(files)
  for (const file of files) {
    const source = todo.find((s) => s.id === file.sourceId)!
    const exemplars = await host.store
      .readSourceBytes(styleId, source)
      .then((bytes) =>
        buildFileExemplars({
          sourceId: file.sourceId,
          kind: source.kind,
          bytes,
          analysis: file.analysis,
          pictures: pagePictures(file, grouped.nameOf)
        })
      )
      .catch(() => [])
    await host.store.writePictures(styleId, file.sourceId, grouped.facts.get(file.sourceId)!)
    await host.store.writeExemplars(styleId, file.sourceId, exemplars)
  }

  const found = grouped.findings.assets
  const ports = await host.ports()
  let batchId = state.meta.pictures?.batchId ?? null
  if (found.length > 0 && ports.review) {
    batchId = await ports.review
      .createReviewBatch({
        source: { kind: 'style', styleId, styleName: state.profile.name },
        candidates: found,
        files: files.map((f) => ({ name: f.fileName, sourceId: f.sourceId })),
        ...(batchId ? { batchId } : {})
      })
      .then((made) => made.batchId)
      .catch(() => batchId)
  }
  await host.commit(state, () => {
    const keys = { ...state.meta.pictures?.keys }
    for (const asset of found) keys[asset.id] = { sha: asset.image.hash, keep: asset.keep }
    state.meta.pictures = { batchId, keys, kept: state.meta.pictures?.kept ?? [] }
  })
}
