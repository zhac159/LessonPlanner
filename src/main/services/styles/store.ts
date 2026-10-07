/**
 * Disk layout and recovery for styles (design/style-profile.md §4):
 *   <dir>/<styleId>/profile.json            current StyleProfile
 *   <dir>/<styleId>/meta.json               name source, saved flag, per-file facts, test slide
 *   <dir>/<styleId>/history/profile.vN.json every version, kept
 *   <dir>/<styleId>/sources/<id>.<ext>      copies of her originals
 *   <dir>/<styleId>/sources/<id>.analysis.json
 *   <dir>/<styleId>/sources/<id>.pictures.json   what the extraction service saw in the file (PictureFactsFile)
 *   <dir>/<styleId>/sources/<id>.exemplars.json  digests of her real slides the analysis named (Exemplar[])
 * Loading never throws on damaged files: it recovers from history, or rebuilds a draft from the sources.
 */
import { copyFile, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileAnalysis } from '@shared/ai/types'
import { pictureFactsFileSchema, type PictureFactsFile } from '@shared/assets/schema'
import { parseFileAnalysis } from '@shared/style/analysisSchema'
import { createDraftProfile } from '@shared/style/draft'
import { exemplarSchema, parseStyleProfile } from '@shared/style/schema'
import type { Exemplar, SourceRef, StyleProfile } from '@shared/style/types'
import { hashFile } from '../../import/validate'
import { atomicWriteJson, ensureDir, readJsonSafe } from '../fsx'
import { z } from 'zod'
import { cleanFileAnalysis, type CleanedAnalysis } from './sourcePlan'
import { emptyMeta, parseStyleMeta } from './metaSchema'
import type { StyleState } from './types'

export class StyleStore {
  constructor(
    private readonly dir: string,
    private readonly now: () => string
  ) {}

  styleDir = (id: string): string => join(this.dir, id)
  private profilePath = (id: string): string => join(this.styleDir(id), 'profile.json')
  private metaPath = (id: string): string => join(this.styleDir(id), 'meta.json')
  private historyDir = (id: string): string => join(this.styleDir(id), 'history')
  private sourcesDir = (id: string): string => join(this.styleDir(id), 'sources')
  /** Where the stored copy of a source file lives. */
  sourcePath = (id: string, source: Pick<SourceRef, 'id' | 'kind'>): string =>
    join(this.sourcesDir(id), `${source.id}.${source.kind}`)
  private analysisPath = (id: string, sourceId: string): string =>
    join(this.sourcesDir(id), `${sourceId}.analysis.json`)

  /** Ids of all style folders on disk. */
  async listIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.dir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  }

  /** Loads one style, repairing what it can. Undefined when the folder has nothing recognisable. */
  async load(id: string): Promise<StyleState | undefined> {
    const meta = await readJsonSafe(this.metaPath(id), parseStyleMeta)
    let profile = await readJsonSafe(this.profilePath(id), parseStyleProfile)
    profile ??= await this.latestSnapshot(id)
    if (!profile && !meta && !(await this.hasSources(id))) return undefined
    const state: StyleState = {
      profile: profile ?? createDraftProfile(id, 'Recovered style', this.now()),
      meta: meta ?? emptyMeta(),
      analyses: new Map()
    }
    if (!profile) await this.rebuildSources(state)
    await this.repair(state)
    return state
  }

  /** Writes profile.json and meta.json atomically. */
  async save(state: StyleState): Promise<void> {
    const id = state.profile.id
    await atomicWriteJson(this.profilePath(id), state.profile)
    await atomicWriteJson(this.metaPath(id), state.meta)
  }

  /** Keeps a copy of this version in history/. */
  async snapshot(profile: StyleProfile): Promise<void> {
    await atomicWriteJson(
      join(this.historyDir(profile.id), `profile.v${profile.version}.json`),
      profile
    )
  }

  async copySource(
    id: string,
    source: Pick<SourceRef, 'id' | 'kind'>,
    from: string
  ): Promise<void> {
    await ensureDir(this.sourcesDir(id))
    await copyFile(from, this.sourcePath(id, source))
  }

  private picturesPath = (id: string, sourceId: string): string =>
    join(this.sourcesDir(id), `${sourceId}.pictures.json`)
  private exemplarsPath = (id: string, sourceId: string): string =>
    join(this.sourcesDir(id), `${sourceId}.exemplars.json`)

  /** The stored analysis, cleaned (source-plan pages and literal dates removed; see sourcePlan.ts), with the plan pages found. */
  async readCleanAnalysis(id: string, sourceId: string): Promise<CleanedAnalysis | undefined> {
    const raw = await readJsonSafe(this.analysisPath(id, sourceId), parseFileAnalysis)
    return raw ? cleanFileAnalysis(raw) : undefined
  }

  /** The stored copy of a source file (for the local picture and exemplar reading). */
  async readSourceBytes(id: string, source: Pick<SourceRef, 'id' | 'kind'>): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.sourcePath(id, source)))
  }

  async readAnalysis(id: string, sourceId: string): Promise<FileAnalysis | undefined> {
    return (await this.readCleanAnalysis(id, sourceId))?.analysis
  }

  readPictures(id: string, sourceId: string): Promise<PictureFactsFile | undefined> {
    return readJsonSafe(this.picturesPath(id, sourceId), (raw) => pictureFactsFileSchema.parse(raw))
  }

  writePictures(id: string, sourceId: string, facts: PictureFactsFile): Promise<void> {
    return atomicWriteJson(this.picturesPath(id, sourceId), facts)
  }

  readExemplars(id: string, sourceId: string): Promise<Exemplar[] | undefined> {
    return readJsonSafe(this.exemplarsPath(id, sourceId), (raw) =>
      z.array(exemplarSchema).parse(raw)
    )
  }

  writeExemplars(id: string, sourceId: string, exemplars: Exemplar[]): Promise<void> {
    return atomicWriteJson(this.exemplarsPath(id, sourceId), exemplars)
  }

  writeAnalysis(id: string, sourceId: string, analysis: FileAnalysis): Promise<void> {
    return atomicWriteJson(this.analysisPath(id, sourceId), analysis)
  }

  deleteAnalysis(id: string, sourceId: string): Promise<void> {
    return rm(this.analysisPath(id, sourceId), { force: true })
  }

  /** Deletes the stored copy and analysis of a source. */
  async deleteSource(id: string, source: Pick<SourceRef, 'id' | 'kind'>): Promise<void> {
    await rm(this.sourcePath(id, source), { force: true })
    await this.deleteAnalysis(id, source.id)
    await rm(this.picturesPath(id, source.id), { force: true })
    await rm(this.exemplarsPath(id, source.id), { force: true })
  }

  /** Deletes a whole style folder. */
  remove(id: string): Promise<void> {
    return rm(this.styleDir(id), { recursive: true, force: true })
  }

  private async hasSources(id: string): Promise<boolean> {
    return (await readdir(this.sourcesDir(id)).catch(() => [])).length > 0
  }

  private async latestSnapshot(id: string): Promise<StyleProfile | undefined> {
    const names = await readdir(this.historyDir(id)).catch(() => [] as string[])
    const versions = names
      .map((name) => /^profile\.v(\d+)\.json$/.exec(name))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]))
      .sort((a, b) => b - a)
    for (const version of versions) {
      const found = await readJsonSafe(
        join(this.historyDir(id), `profile.v${version}.json`),
        parseStyleProfile
      )
      if (found) return found
    }
    return undefined
  }

  /** Profile lost: rebuild the source list from meta.json and the files on disk. */
  private async rebuildSources(state: StyleState): Promise<void> {
    const id = state.profile.id
    const present = new Set(await readdir(this.sourcesDir(id)).catch(() => [] as string[]))
    for (const [sourceId, file] of Object.entries(state.meta.files)) {
      if (!present.has(`${sourceId}.${file.kind}`)) continue
      state.profile.sources.push({
        id: sourceId,
        fileName: file.fileName,
        kind: file.kind,
        pages: 0,
        status: present.has(`${sourceId}.analysis.json`) ? 'learned' : 'waiting',
        addedAt: file.addedAt
      })
    }
  }

  /** Makes sources consistent with disk: crashed "reading" and missing analyses go back to "waiting". */
  private async repair(state: StyleState): Promise<void> {
    const id = state.profile.id
    const planPages = new Map<string, number[]>()
    for (const source of state.profile.sources) {
      if (source.status === 'reading') source.status = 'waiting'
      if (source.status === 'learned') {
        const found = await this.readCleanAnalysis(id, source.id)
        if (found) state.analyses.set(source.id, found.analysis)
        else source.status = 'waiting'
        planPages.set(source.id, found?.planPages ?? [])
      }
      state.meta.files[source.id] ??= {
        fileName: source.fileName,
        kind: source.kind,
        addedAt: source.addedAt,
        hash: await hashFile(this.sourcePath(id, source)).catch(() => ''),
        mayContainNames: false
      }
      const pages = planPages.get(source.id)
      if (pages?.length)
        state.meta.files[source.id]!.sourcePlanPages = [
          ...new Set([...(state.meta.files[source.id]!.sourcePlanPages ?? []), ...pages])
        ].sort((a, b) => a - b)
    }
  }
}
