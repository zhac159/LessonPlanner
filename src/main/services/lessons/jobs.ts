/**
 * The running AI jobs (generation, chat turn, plugin run). One job per lesson at a time (06 §7); each has an
 * AbortController so "Stop" cancels it. Shared by GenerationService, ChatService and PluginRunner.
 */
import type { JobKind } from '@shared/contracts/deck-builder'
import { fail, ok, type Result } from '@shared/result'

export interface Job {
  readonly id: string
  readonly lessonId: string
  readonly kind: JobKind
  /** The assistant message the job's events belong to. */
  readonly messageId: string
  readonly signal: AbortSignal
  /** Settles when the job's work has finished (set by `attach`). */
  done: Promise<void>
}

interface Entry {
  job: Job
  controller: AbortController
}

export const LESSON_BUSY =
  'Claude is still working on this lesson. Wait for it to finish, or press Stop.'

export class JobRegistry {
  private readonly byId = new Map<string, Entry>()
  private readonly byLesson = new Map<string, Entry>()

  constructor(private readonly ids: (prefix: string) => string) {}

  /** Starts a job for the lesson, or fails when the lesson already has one. */
  start(lessonId: string, kind: JobKind, messageId: string): Result<{ job: Job }> {
    if (this.byLesson.has(lessonId)) return fail('invalid-input', LESSON_BUSY)
    const controller = new AbortController()
    const job: Job = {
      id: this.ids('job'),
      lessonId,
      kind,
      messageId,
      signal: controller.signal,
      done: Promise.resolve()
    }
    const entry = { job, controller }
    this.byId.set(job.id, entry)
    this.byLesson.set(lessonId, entry)
    return ok({ job })
  }

  /**
   * Runs `work` as the job's body: the job is finished (and the lesson free again) when it settles, however it
   * settles. Returns `job.done`, which never rejects.
   */
  attach(job: Job, work: () => Promise<void>): Promise<void> {
    job.done = work()
      .catch(() => undefined)
      .finally(() => this.finish(job.id))
    return job.done
  }

  private finish(jobId: string): void {
    const entry = this.byId.get(jobId)
    if (!entry) return
    this.byId.delete(jobId)
    if (this.byLesson.get(entry.job.lessonId) === entry) this.byLesson.delete(entry.job.lessonId)
  }

  /** Aborts a running job. False when it is unknown or already finished. */
  cancel(jobId: string): boolean {
    const entry = this.byId.get(jobId)
    if (!entry) return false
    entry.controller.abort()
    return true
  }

  /** The job running for a lesson, if any. */
  running(lessonId: string): Job | undefined {
    return this.byLesson.get(lessonId)?.job
  }

  get(jobId: string): Job | undefined {
    return this.byId.get(jobId)?.job
  }
}
