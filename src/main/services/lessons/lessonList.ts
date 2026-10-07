/** What Home shows: the list rows (index entry + thumbnail + running state) and the `lessonsChanged` event. */
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { JobRegistry } from './jobs'
import type { LessonStore } from './store'
import { toListItem, type LessonListItem, type SummaryIndex } from './summary'
import type { EmitEvent, Logger } from './types'

export class LessonList {
  constructor(
    private readonly deps: {
      index: SummaryIndex
      store: LessonStore
      jobs: JobRegistry
      emit: EmitEvent | undefined
      log: Logger
    }
  ) {}

  /** All lessons, most recently changed first. Lessons whose files are damaged are marked `damaged`. */
  async list(): Promise<LessonListItem[]> {
    const entries = await this.deps.index.list()
    return Promise.all(entries.map((entry) => this.item(entry.id)))
  }

  /** One lesson's list row, or undefined for an unknown lesson. */
  async summaryOf(lessonId: string): Promise<LessonSummary | undefined> {
    return (await this.deps.index.get(lessonId)) ? this.item(lessonId) : undefined
  }

  private async item(lessonId: string): Promise<LessonListItem> {
    const entry = (await this.deps.index.get(lessonId))!
    const thumb = entry.damaged ? undefined : await this.deps.store.readThumb(lessonId)
    return toListItem(entry, thumb, this.deps.jobs.running(lessonId)?.kind === 'generation')
  }

  /** Sends `lessonsChanged` with the current list (no-op without an `emit`). */
  async notify(): Promise<void> {
    if (!this.deps.emit) return
    try {
      this.deps.emit('lessonsChanged', await this.list())
    } catch (error) {
      this.deps.log.warn(`Could not send the lesson list: ${String(error)}`)
    }
  }

  /** Flags a lesson whose files cannot be read, so Home shows its recoverable card. */
  async markDamaged(lessonId: string): Promise<void> {
    const entry = await this.deps.index.get(lessonId)
    if (entry && !entry.damaged) {
      await this.deps.index.upsert({ ...entry, damaged: true })
      await this.notify()
    }
  }
}
