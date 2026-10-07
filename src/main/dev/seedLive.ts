/**
 * The second step of the "generating" seed, run once the deck-builder module is live: a running generation
 * job needs the module's own in-memory services, so it cannot be written to disk. The job never produces
 * slides; it reports "writing 2 of 8" every 1.5 s until the teacher presses Stop (or the app quits).
 */
import type { CurrentDeckBuilder } from '../services/deckBuilder/current'
import { GENERATING_LESSON } from './seedData'

export const PROGRESS_EVERY_MS = 1500

/** Starts the never-finishing generation job for the "generating" seed's lesson. Returns false if it could not. */
export function startSeedGeneration(current: CurrentDeckBuilder): boolean {
  const { lessons } = current.services
  const lessonId = GENERATING_LESSON.id
  const started = lessons.jobs.start(lessonId, 'generation', 'msg_seed_gen_2')
  if (!started.ok) return false
  const { job } = started
  const report = (): void =>
    current.emit('gen-progress', {
      lessonId,
      stage: 'writing',
      done: 2,
      total: 8,
      title: GENERATING_LESSON.title
    })
  void lessons.jobs
    .attach(
      job,
      () =>
        new Promise<void>((resolve) => {
          const timer = setInterval(report, PROGRESS_EVERY_MS)
          timer.unref()
          job.signal.addEventListener('abort', () => {
            clearInterval(timer)
            resolve()
          })
          report()
        })
    )
    .then(() => lessons.notifyChanged())
  void lessons.notifyChanged()
  return true
}
