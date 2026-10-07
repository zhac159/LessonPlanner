import { describe, expect, it, vi } from 'vitest'
import type { GenProgress } from '@shared/contracts/deck-builder'
import { createFakeAiService } from '../ai/fake'
import { createDeckBuilderServices } from '../services/deckBuilder/services'
import { fakeStyleLookup } from '../services/deckBuilder/testing'
import { FakeDialogs, tempDir } from '../services/lessons/testing'
import { GENERATING_ID } from './seedData'
import { PROGRESS_EVERY_MS, startSeedGeneration } from './seedLive'

async function live() {
  const events: Array<{ name: string; payload: unknown }> = []
  const emit = (name: string, payload: unknown): void => void events.push({ name, payload })
  const services = await createDeckBuilderServices({
    dir: tempDir(),
    ai: createFakeAiService(),
    styles: fakeStyleLookup(),
    dialogs: new FakeDialogs(),
    emit
  })
  return { services, events, emit }
}

describe('startSeedGeneration', () => {
  it('keeps the seed lesson generating, reports progress, and ends on Stop', async () => {
    vi.useFakeTimers()
    try {
      const { services, events, emit } = await live()
      expect(startSeedGeneration({ services, emit: emit as never })).toBe(true)
      expect(services.lessons.jobs.running(GENERATING_ID)).toBeDefined()
      const first = events.find((e) => e.name === 'gen-progress')?.payload as GenProgress
      expect(first).toMatchObject({ lessonId: GENERATING_ID, stage: 'writing', done: 2, total: 8 })

      await vi.advanceTimersByTimeAsync(PROGRESS_EVERY_MS * 2)
      expect(events.filter((e) => e.name === 'gen-progress').length).toBeGreaterThanOrEqual(3)

      const job = services.lessons.jobs.running(GENERATING_ID)!
      services.generation.cancel(job.id)
      await job.done
      expect(services.lessons.jobs.running(GENERATING_ID)).toBeUndefined()
      const count = events.length
      await vi.advanceTimersByTimeAsync(PROGRESS_EVERY_MS * 3)
      expect(events.filter((e) => e.name === 'gen-progress')).toHaveLength(
        events.slice(0, count).filter((e) => e.name === 'gen-progress').length
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('does nothing when the lesson already has a job', async () => {
    const { services, emit } = await live()
    const current = { services, emit: emit as never }
    expect(startSeedGeneration(current)).toBe(true)
    expect(startSeedGeneration(current)).toBe(false)
    const job = services.lessons.jobs.running(GENERATING_ID)!
    services.generation.cancel(job.id)
    await job.done
  })
})
