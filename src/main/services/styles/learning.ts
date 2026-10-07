/** Starting, joining, pausing and cancelling a style's learning job, plus the debounced re-synthesis. */
import { ok, type Result } from '@shared/result'
import type { StyleCore } from './core'
import { clearPause } from './fileOps'
import { LearnJob } from './learnJob'
import type { LearnHandle, LearnOutcome, StyleState } from './types'
import { countByStatus } from './views'

function handleOf(styleId: string, job: LearnJob): LearnHandle {
  return {
    styleId,
    get done(): Promise<LearnOutcome> {
      return job.done
    },
    cancel: () => job.cancel()
  }
}

export class LearningControl {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  /**
   * A job leaves `core.jobs` before its closing commit has been written (the commit must see it as finished), so the
   * window between the two is tracked here: `whenIdle` and `stop` wait for it too, and nobody tears the folder down
   * under a save that is still running.
   */
  private readonly closing = new Map<string, Promise<void>>()

  constructor(private readonly core: StyleCore) {}

  /** Starts the style's job, or joins the one already running. Resolves once the job is registered. */
  start(state: StyleState): Result<{ job: LearnHandle }> {
    const styleId = state.profile.id
    const running = this.core.jobs.get(styleId)
    if (running) return ok({ job: handleOf(styleId, running) })
    this.clearResynthesis(styleId)
    const job = new LearnJob(state, this.core, this.core.concurrency)
    this.core.jobs.set(styleId, job)
    job.done = job.start().finally(async () => {
      this.core.jobs.delete(styleId)
      await this.core.commit(state)
      this.core.emitProgress(state)
      this.core.emitChanged()
    })
    const closing = job.done.then(
      () => undefined,
      () => undefined // whoever holds the handle sees the failure; this chain only marks the end
    )
    this.closing.set(styleId, closing)
    void closing.then(() => {
      if (this.closing.get(styleId) === closing) this.closing.delete(styleId)
    })
    return ok({ job: handleOf(styleId, job) })
  }

  /** "Carry on": clears the pause, requeues files that failed only because Claude was unreachable, restarts. */
  async resume(state: StyleState): Promise<void> {
    await clearPause(this.core, state)
    this.start(state)
  }

  cancel(styleId: string): void {
    this.core.jobs.get(styleId)?.cancel()
  }

  /** Resolves when no job is running for the style. */
  async whenIdle(styleId: string): Promise<void> {
    for (;;) {
      const pending = this.core.jobs.get(styleId)?.done ?? this.closing.get(styleId)
      if (!pending) return
      await pending
    }
  }

  /** At app start: carry on with styles that still have waiting files and are not paused. */
  resumePending(): void {
    for (const state of this.core.states.values()) {
      if (countByStatus(state, 'waiting') > 0 && !state.meta.pausedFor) this.start(state)
    }
  }

  /** Cancels the job and any pending re-synthesis, and waits for the job to wind down. */
  async stop(styleId: string): Promise<void> {
    this.clearResynthesis(styleId)
    const job = this.core.jobs.get(styleId)
    job?.cancel()
    await job?.done.catch(() => undefined)
    await this.closing.get(styleId)
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.core.states.keys()].map((id) => this.stop(id)))
  }

  /** Spec: synthesis re-runs 10 s after the last removal (debounced). */
  scheduleResynthesis(styleId: string): void {
    this.clearResynthesis(styleId)
    const timer = setTimeout(() => {
      this.timers.delete(styleId)
      const state = this.core.states.get(styleId)
      if (state) this.start(state)
    }, this.core.resynthesiseDelayMs)
    timer.unref?.()
    this.timers.set(styleId, timer)
  }

  private clearResynthesis(styleId: string): void {
    clearTimeout(this.timers.get(styleId))
    this.timers.delete(styleId)
  }
}
