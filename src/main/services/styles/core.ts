/**
 * Shared machinery of the styles service: the in-memory states (written through to disk), a per-style lock,
 * event emission, job registry and the default-style invariant. `StylesService` and `fileOps` build on it.
 */
import { newId } from '@shared/ids'
import type { StyleSummary } from '@shared/contracts/style-library'
import type { SourceRef, StyleProfile } from '@shared/style/types'
import { extractAssets } from '../../import/assets'
import { readInstalledFonts } from '../../export/installedFonts'
import { computeHabits, keptChanged, pictureView, type PicturePorts } from './habits'
import { LearnJob, type JobHost, type Runtime } from './learnJob'
import { defaultPorts } from './picturePorts'
import { StyleStore } from './store'
import { deriveStatus } from './status'
import type { EmitStyleEvent, StyleState, StylesServiceDeps } from './types'
import { draftView, fileView, profileView, progressView, summaryView } from './views'

export class StyleCore implements JobHost {
  readonly ai: StylesServiceDeps['ai']
  readonly store: StyleStore
  readonly states = new Map<string, StyleState>()
  readonly jobs = new Map<string, LearnJob>()
  readonly concurrency: number
  readonly limits: { maxFiles?: number; maxFileBytes?: number }
  readonly resynthesiseDelayMs: number
  readonly ids: (prefix: string) => string
  readonly extract: JobHost['extract']
  readonly installedFonts: JobHost['installedFonts']
  private readonly portsOf: () => Promise<PicturePorts> | PicturePorts
  private readonly clock: () => Date
  private readonly emitEvent: EmitStyleEvent
  private readonly locks = new Map<string, Promise<unknown>>()
  private loaded: Promise<void> | undefined

  constructor(deps: StylesServiceDeps) {
    this.ai = deps.ai
    this.clock = deps.clock ?? (() => new Date())
    this.emitEvent = deps.emit ?? (() => undefined)
    this.ids = deps.ids ?? newId
    this.concurrency = deps.concurrency ?? 2
    this.limits = deps.limits ?? {}
    this.resynthesiseDelayMs = deps.resynthesiseDelayMs ?? 10_000
    this.store = new StyleStore(deps.dir, () => this.nowIso())
    this.extract = deps.extract ?? extractAssets
    this.portsOf = deps.ports ?? defaultPorts
    this.installedFonts = deps.installedFonts ?? (() => readInstalledFonts())
  }

  ports = async (): Promise<PicturePorts> => this.portsOf()

  /**
   * Brings the picture habits and the A6 data up to date: rebuilds the habits when the assets she keeps changed (or none were
   * built yet), then reads names and thumbnails for the cards. Never throws: the cards just keep what they had.
   */
  async refreshPictures(state: StyleState, force = false): Promise<void> {
    try {
      const ports = await this.ports()
      const meta = state.meta.pictures
      if (meta && (force || keptChanged(state, ports))) {
        const built = await computeHabits(this.store, state, ports)
        if (built)
          await this.commit(state, () => {
            if (built.habits) state.profile.pictures = built.habits
            else delete state.profile.pictures
            if (state.meta.pictures) state.meta.pictures.kept = built.kept
          })
      }
      state.pictureView = await pictureView(state, ports)
    } catch {
      /* keep the previous view */
    }
  }

  nowMs = (): number => this.clock().getTime()
  nowIso = (): string => this.clock().toISOString()

  /** Loads every style folder once; later calls return the same promise. */
  ready(): Promise<void> {
    this.loaded ??= this.loadAll()
    return this.loaded
  }

  private async loadAll(): Promise<void> {
    for (const id of await this.store.listIds()) {
      const state = await this.store.load(id)
      if (state) this.states.set(state.profile.id, state)
    }
    await this.ensureDefault()
  }

  /** Runs `task` after earlier work on the same style has finished (never overlapping). */
  private lock<T>(id: string, task: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(id) ?? Promise.resolve()).then(task, task)
    this.locks.set(
      id,
      run.catch(() => undefined)
    )
    return run
  }

  /** Applies `mutate` (synchronously, so checks and changes are atomic), then persists. */
  commit(state: StyleState, mutate?: () => void): Promise<void> {
    return this.lock(state.profile.id, async () => {
      mutate?.()
      state.profile.status = deriveStatus(state, this.jobs.has(state.profile.id))
      state.profile.updatedAt = this.nowIso()
      await this.store.save(state)
    })
  }

  runtimeOf(styleId: string): Runtime | undefined {
    return this.jobs.get(styleId)?.runtime()
  }

  emitProgress(
    state: StyleState,
    runtime?: Runtime,
    extra: { file?: SourceRef; partial?: StyleProfile; name?: string } = {}
  ): void {
    this.emitEvent('progress', {
      styleId: state.profile.id,
      progress: progressView(state, runtime ?? this.runtimeOf(state.profile.id)),
      ...(extra.file ? { file: fileView(state, extra.file) } : {}),
      ...(extra.partial ? { partialProfile: profileView(state, extra.partial) ?? undefined } : {}),
      ...(extra.name ? { name: extra.name } : {})
    })
  }

  /** Summaries, default style first, then most recently changed. */
  summaries(): StyleSummary[] {
    return [...this.states.values()]
      .map(summaryView)
      .sort(
        (a, b) =>
          Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt)
      )
  }

  emitChanged(): void {
    this.emitEvent('changed', this.summaries())
  }

  view(state: StyleState) {
    return draftView(state, this.runtimeOf(state.profile.id))
  }

  /** Exactly one default whenever any style exists: promote the best ready style if none is marked. */
  async ensureDefault(): Promise<void> {
    const all = [...this.states.values()]
    const defaults = all.filter((s) => s.profile.isDefault)
    if (all.length === 0 || defaults.length === 1) return
    const rank = (s: StyleState) => `${s.profile.status === 'ready' ? 1 : 0}${s.profile.updatedAt}`
    const keep = [...(defaults.length ? defaults : all)].sort((a, b) =>
      rank(b).localeCompare(rank(a))
    )[0]
    for (const state of all) {
      const wanted = state === keep
      if (state.profile.isDefault !== wanted)
        await this.commit(state, () => (state.profile.isDefault = wanted))
    }
  }
}
