/**
 * The cancellable learning job for one style (design/style-profile.md §2, 04-create-style.md §8):
 * read waiting files two at a time, learn each (digest locally, then one Claude call), publish a local-merge
 * preview after every file, then synthesise once. One bad file never stops the others; an account problem
 * pauses the queue; cancelling keeps what was learned.
 */
import type { AiService } from '@shared/ai/types'
import type { LearnProgress } from '@shared/contracts/style-library'
import type { AiErrorCode } from '@shared/result'
import type { Slide } from '@shared/deck/types'
import type { SourceRef, StyleProfile } from '@shared/style/types'
import { IMPORT_MESSAGES, isImportError } from '../../import/errors'
import { prepareSource } from '../../import/readSource'
import { fileErrorFromFailure, isAccountError } from './aiFailure'
import { finishSynthesis } from './defects'
import type { InstalledFonts } from './fonts'
import type { PicturePorts } from './habits'
import { previewProfile, refreshLocalProfile } from './localMerge'
import { runPicturesStep } from './picturesStep'
import type { ExtractFn } from './pictures'
import { cleanFileAnalysis } from './sourcePlan'
import type { StyleStore } from './store'
import { applySynthesis } from './synthesis'
import type { FileError, LearnOutcome, StyleState } from './types'
import { pendingCount } from './views'

/** Seconds per file assumed until the first file has been timed (04-create-style.md §6). */
const INITIAL_SECONDS_PER_FILE = 30
const AVERAGE_WINDOW = 5
/** Consecutive network failures after which the whole queue pauses. */
const NETWORK_PAUSE_AFTER = 2

export interface Runtime {
  stage: LearnProgress['stage']
  etaSeconds: number | null
}

/** What the job needs from its owner (the service): persistence, events and the AI. */
export interface JobHost {
  ai: AiService
  store: StyleStore
  nowMs(): number
  nowIso(): string
  /** The local picture extractor, the review queue and the library (null ports while the assets module is not running). */
  extract: ExtractFn
  ports(): Promise<PicturePorts>
  installedFonts: InstalledFonts
  /** Rebuilds the habits and the A6 view data from the stored facts and the assets she has kept. */
  refreshPictures(state: StyleState, force?: boolean): Promise<void>
  /** Applies `mutate`, then persists (serialised per style) and keeps `status` in sync. */
  commit(state: StyleState, mutate?: () => void): Promise<void>
  emitProgress(
    state: StyleState,
    runtime: Runtime,
    extra?: { file?: SourceRef; partial?: StyleProfile; name?: string }
  ): void
}

export class LearnJob {
  /** Resolves when the job ends; only valid after `start()`. */
  done: Promise<LearnOutcome> = Promise.resolve('nothing-to-do')
  private readonly controller = new AbortController()
  private readonly fileControllers = new Map<string, AbortController>()
  private readonly seconds: number[] = []
  private stage: LearnProgress['stage'] = 'reading'
  private pausedFor: AiErrorCode | undefined
  private networkStreak = 0

  constructor(
    private readonly state: StyleState,
    private readonly host: JobHost,
    private readonly concurrency: number
  ) {}

  /** Begins the job (separate from the constructor so the owner can register it first). */
  start(): Promise<LearnOutcome> {
    this.done = this.run()
    return this.done
  }

  /** Stops reading; files in flight go back to waiting, learned files stay learned. */
  cancel(): void {
    this.controller.abort()
  }

  /** Aborts the request for one file (it was removed). */
  cancelFile(sourceId: string): void {
    this.fileControllers.get(sourceId)?.abort()
  }

  /** Current stage and ETA for progress payloads (remaining files × moving average per file). */
  runtime(): Runtime {
    const recent = this.seconds.slice(-AVERAGE_WINDOW)
    const average = recent.length
      ? recent.reduce((a, b) => a + b, 0) / recent.length
      : INITIAL_SECONDS_PER_FILE
    const remaining = pendingCount(this.state)
    const showEta = this.stage === 'reading' && remaining > 0
    return { stage: this.stage, etaSeconds: showEta ? Math.round(remaining * average) : null }
  }

  private async run(): Promise<LearnOutcome> {
    const { state, host } = this
    if (pendingCount(state) === 0 && (state.analyses.size === 0 || state.meta.synthesised)) {
      return 'nothing-to-do'
    }
    await host.commit(state, () => {
      state.meta.pausedFor = undefined
    })
    host.emitProgress(state, this.runtime())

    await this.readFiles()
    if (this.controller.signal.aborted) return this.finish('cancelled', 'idle')
    if (this.pausedFor) return this.finish('paused', 'paused')
    await this.looksAtPictures()
    if (this.controller.signal.aborted) return this.finish('cancelled', 'idle')
    if (state.analyses.size > 0 && !state.meta.synthesised) await this.synthesise()
    if (this.pausedFor) return this.finish('paused', 'paused')
    return this.finish('completed', 'done')
  }

  private async finish(
    outcome: LearnOutcome,
    stage: LearnProgress['stage']
  ): Promise<LearnOutcome> {
    const { state, host } = this
    this.stage = stage
    await host.commit(state, () => {
      for (const source of state.profile.sources)
        if (source.status === 'reading') source.status = 'waiting'
      state.meta.pausedFor = this.pausedFor
    })
    host.emitProgress(state, { stage, etaSeconds: null })
    return outcome
  }

  /** Keeps up to `concurrency` files in flight until nothing is waiting, the job is cancelled or paused. */
  private async readFiles(): Promise<void> {
    const running = new Set<Promise<void>>()
    while (!this.controller.signal.aborted && !this.pausedFor) {
      while (running.size < this.concurrency) {
        const next = this.state.profile.sources.find((s) => s.status === 'waiting')
        if (!next) break
        next.status = 'reading' // claimed synchronously so two workers never take the same file
        const task: Promise<void> = this.readOne(next).finally(() => running.delete(task))
        running.add(task)
      }
      if (running.size === 0) break
      await Promise.race(running)
    }
    await Promise.all(running)
  }

  private async readOne(source: SourceRef): Promise<void> {
    const { state, host } = this
    const own = new AbortController()
    this.fileControllers.set(source.id, own)
    const signal = AbortSignal.any([this.controller.signal, own.signal])
    const started = host.nowMs()
    const stale = () => !state.profile.sources.includes(source)
    try {
      await host.commit(state)
      host.emitProgress(state, this.runtime(), { file: source })
      const prepared = await prepareSource(
        host.store.sourcePath(state.profile.id, source),
        source.kind,
        source.fileName
      )
      if (stale()) return
      await host.commit(state, () => {
        if (stale()) return
        source.pages = prepared.units
        state.meta.files[source.id].mayContainNames = prepared.mayContainNames
      })
      const result = await host.ai.analyseStyleFile(prepared.input, { signal })
      if (stale()) return
      if (signal.aborted || (!result.ok && result.code === 'cancelled')) return this.requeue(source)
      if (!result.ok) {
        if (isAccountError(result.code)) {
          this.pausedFor = result.code
          return this.requeue(source)
        }
        return this.fail(source, fileErrorFromFailure(result))
      }
      // her scheme's own plan page is not a slide, and a copied date is not style: cleaned before anything is learned
      const cleaned = cleanFileAnalysis(result.analysis)
      await host.store.writeAnalysis(state.profile.id, source.id, result.analysis)
      this.networkStreak = 0
      await host.commit(state, () => {
        if (stale()) return
        state.analyses.set(source.id, cleaned.analysis)
        if (cleaned.planPages.length)
          state.meta.files[source.id].sourcePlanPages = cleaned.planPages
        source.status = 'learned'
        delete state.meta.files[source.id].error
        state.meta.synthesised = false
        refreshLocalProfile(state)
      })
      if (stale()) return
      this.seconds.push((host.nowMs() - started) / 1000)
      host.emitProgress(state, this.runtime(), { file: source, partial: previewProfile(state) })
    } catch (error) {
      if (stale()) return
      await this.fail(source, this.errorOf(error))
    } finally {
      this.fileControllers.delete(source.id)
    }
  }

  private errorOf(error: unknown): FileError {
    if (isImportError(error)) {
      // "missing" (file vanished from the sources folder) reads as damaged to the teacher
      if (error.code === 'missing')
        return { code: 'corrupt', message: IMPORT_MESSAGES.corrupt, retryable: false }
      return { code: error.code as FileError['code'], message: error.message, retryable: false }
    }
    return { code: 'unknown', message: 'Something went wrong reading this file', retryable: true }
  }

  /** A reading file that did not finish goes back to the queue. */
  private async requeue(source: SourceRef): Promise<void> {
    await this.host.commit(this.state, () => {
      if (source.status === 'reading') source.status = 'waiting'
    })
    this.host.emitProgress(this.state, this.runtime(), { file: source })
  }

  private async fail(source: SourceRef, error: FileError): Promise<void> {
    if (error.code === 'network' && ++this.networkStreak >= NETWORK_PAUSE_AFTER)
      this.pausedFor = 'network'
    else if (error.code !== 'network') this.networkStreak = 0
    await this.host.commit(this.state, () => {
      if (!this.state.meta.files[source.id]) return
      source.status = 'failed'
      source.error = error.message
      this.state.meta.files[source.id].error = error
    })
    this.host.emitProgress(this.state, this.runtime(), { file: source })
  }

  /** The local picture step (no Claude): facts, exemplars, the review batch and the habits. A failure here never stops the style. */
  private async looksAtPictures(): Promise<void> {
    const { state, host } = this
    this.stage = 'pictures'
    host.emitProgress(state, this.runtime())
    try {
      await runPicturesStep(state, host, this.controller.signal)
    } catch (error) {
      console.error('[styles] picture step failed', error instanceof Error ? error.message : '')
    }
    await host.refreshPictures(state, true).catch(() => undefined)
    host.emitProgress(state, this.runtime(), { partial: state.profile })
  }

  /** One Claude call over all analyses; on failure the local-merge profile stays and is still usable. */
  private async synthesise(): Promise<void> {
    const { state, host } = this
    this.stage = 'synthesising'
    host.emitProgress(state, this.runtime())
    const analyses = state.profile.sources.flatMap((s) => {
      const analysis = state.analyses.get(s.id)
      return s.status === 'learned' && analysis ? [analysis] : []
    })
    const exemplars = await Promise.all(
      state.profile.sources
        .filter((s) => s.status === 'learned')
        .map(async (s) => (await host.store.readExemplars(state.profile.id, s.id)) ?? [])
    )
    const result = await host.ai.synthesiseProfile(
      {
        name: state.profile.name,
        analyses,
        existing: state.meta.hasSynthesis ? state.profile : undefined
      },
      { signal: this.controller.signal }
    )
    if (this.controller.signal.aborted) return
    if (!result.ok) {
      if (isAccountError(result.code)) this.pausedFor = result.code
      return
    }
    let finished: { profile: StyleProfile; testSlide: Slide | null } = {
      profile: result.profile,
      testSlide: result.testSlide
    }
    try {
      finished = await finishSynthesis(result.profile, result.testSlide, {
        analyses,
        exemplars,
        installedFonts: host.installedFonts
      })
    } catch {
      // not a profile the checks can read: applySynthesis validates it and refuses it
    }
    if (this.controller.signal.aborted) return
    let renamed: string | null = null
    await host.commit(state, () => {
      const applied = applySynthesis(state, finished.profile, finished.testSlide, host.nowIso())
      if (applied.ok) renamed = applied.name
    })
    if (state.meta.synthesised) await host.store.snapshot(state.profile)
    host.emitProgress(state, this.runtime(), {
      partial: state.profile,
      ...(renamed ? { name: renamed } : {})
    })
  }
}
