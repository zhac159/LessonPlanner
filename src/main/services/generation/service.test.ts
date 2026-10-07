import { describe, expect, it } from 'vitest'
import { aiFailure, cancelledFailure } from '@shared/ai/errors'
import type { AiService, LessonPlan } from '@shared/ai/types'
import type { GenProgress } from '@shared/contracts/deck-builder'
import { ok } from '@shared/result'
import { createFakeAiService } from '../../ai/fake'
import { ChatService } from '../chat/service'
import { NOTHING_TO_FINISH } from './service'
import { makeGenerationRig, sleep, type GenerationRig } from './testing'

const TEXT =
  'Photosynthesis\nLO1: Where it happens\nLO2: The word equation\nLO3: Why it is endothermic'
const base = createFakeAiService()

async function run(rig: GenerationRig, text = TEXT, meta = {}) {
  const started = await rig.generation.generate({
    lessonId: rig.lessonId,
    text,
    documentIds: [],
    meta
  })
  if (!started.ok) throw new Error(started.message)
  await rig.generation.whenDone(started.jobId)
  return started
}

const historyOf = (rig: GenerationRig) =>
  new ChatService({ lessons: rig.service, ai: rig.ai, store: rig.store, emit: rig.emit }).history(
    rig.lessonId
  )

const slidesOf = async (rig: GenerationRig) => {
  const opened = await rig.service.open(rig.lessonId)
  if (!opened.ok) throw new Error(opened.message)
  return opened
}

describe('a complete generation', () => {
  it('reads, plans, writes every slide and commits ONE undo step', async () => {
    const rig = await makeGenerationRig()
    const started = await run(rig, TEXT, { yearGroup: 'Y8', durationMin: 50, targetSlideCount: 8 })
    expect(started.messageId).toMatch(/^msg_/)

    const opened = await slidesOf(rig)
    expect(opened.deck.slides).toHaveLength(8)
    expect(opened.deck.slides.map((s) => s.kind)).toEqual([
      'title',
      'do-now',
      'objectives',
      'content',
      'content',
      'question',
      'check',
      'exit-ticket'
    ])
    expect(new Set(opened.deck.slides.map((s) => s.id)).size).toBe(8)
    expect(opened.deck.slides.every((s) => s.source?.by === 'ai')).toBe(true)
    expect(opened.deck.title).toBe('Photosynthesis')
    expect(opened.deck.meta).toMatchObject({
      yearGroup: 'Y8',
      durationMin: 50,
      objectives: ['Where it happens', 'The word equation', 'Why it is endothermic']
    })
    expect(opened.titleSource).toBe('auto')
    expect(opened.history).toMatchObject({ canUndo: true, undoSummary: 'Made 8 slides' })

    const undone = await rig.service.undo(rig.lessonId)
    expect(undone.ok && undone.deck.slides).toHaveLength(0)
    expect(undone.ok && undone.deck.title).toBe('Untitled lesson')
    expect(undone.ok && undone.history.canUndo).toBe(false)
  })

  it('sends progress, one slide-ready per slide, then one chat:changes and the end', async () => {
    const rig = await makeGenerationRig()
    await run(rig, TEXT, { targetSlideCount: 8 })
    const progress = rig.of('gen-progress') as GenProgress[]
    expect(progress.map((p) => p.stage)).toEqual([
      'reading',
      'planning',
      'planning',
      'planning',
      'writing',
      ...Array(9).fill('writing'),
      'done'
    ])
    const writing = progress.filter((p) => p.stage === 'writing')
    expect(writing[0]).toMatchObject({ done: 0, total: 8, title: 'Photosynthesis' })
    expect(writing.at(-1)).toMatchObject({ done: 8, total: 8 })
    expect(progress.at(-1)).toMatchObject({ stage: 'done', done: 8, total: 8 })

    const ready = rig.of('slide-ready') as Array<{ index: number; slide: { id: string } }>
    expect(ready).toHaveLength(8)
    expect(ready.map((r) => r.index).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    const opened = await slidesOf(rig)
    for (const r of ready) expect(opened.deck.slides[r.index].id).toBe(r.slide.id)

    const names = rig.names()
    expect(names.filter((n) => n === 'chat:changes')).toHaveLength(1)
    expect(names.indexOf('slide-ready')).toBeLessThan(names.indexOf('chat:changes'))
    expect(names.slice(-2)).toEqual(['gen-progress', 'chat:done'])
    expect(rig.names()).not.toContain('ai:error')
    const [change] = rig.of('chat:changes') as Array<{ changeSet: { ops: unknown[]; by: string } }>
    expect(change.changeSet.by).toBe('ai')
    expect(change.changeSet.ops).toHaveLength(9)
  })

  it('does not change the deck on disk until the end', async () => {
    let seenAtSlide: number | undefined
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          const mid = await rig.service.open(rig.lessonId)
          if (input.index === 2 && mid.ok) seenAtSlide = mid.deck.slides.length
          return base.writeSlide(input, opts)
        }
      }
    })
    await run(rig)
    expect(seenAtSlide).toBe(0)
  })

  it('stores the message with its ResultChip and the plan summary', async () => {
    const rig = await makeGenerationRig()
    await run(rig, TEXT, { targetSlideCount: 8 })
    const items = await historyOf(rig)
    expect(items.map((i) => i.role)).toEqual(['user', 'assistant'])
    expect(items[0].text).toBe(TEXT)
    expect(items[1].text).toMatch(/^A 8-slide lesson covering 3 objectives/)
    expect(items[1].result).toMatchObject({ label: '8 slides added', undone: false })
    expect(items[1].result?.slideIds).toHaveLength(8)
  })

  it('marks the lesson as generating while it runs and ready afterwards', async () => {
    let during: string | undefined
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          during ??= (await rig.service.list()).find((l) => l.id === rig.lessonId)?.status
          return base.writeSlide(input, opts)
        }
      }
    })
    await run(rig)
    expect(during).toBe('generating')
    expect((await rig.service.list()).find((l) => l.id === rig.lessonId)?.status).toBe('ready')
    expect(rig.changed.at(-1)?.find((l) => l.id === rig.lessonId)?.status).toBe('ready')
  })

  it('never overwrites a title the teacher set, and sends no title proposal', async () => {
    const rig = await makeGenerationRig()
    await rig.service.rename(rig.lessonId, 'My own title')
    await run(rig)
    const opened = await slidesOf(rig)
    expect(opened.deck.title).toBe('My own title')
    const progress = rig.of('gen-progress') as GenProgress[]
    expect(progress.some((p) => p.title !== undefined)).toBe(false)
  })

  it('refuses empty input and a second job on the same lesson', async () => {
    const rig = await makeGenerationRig()
    expect(
      await rig.generation.generate({
        lessonId: rig.lessonId,
        text: '  ',
        documentIds: [],
        meta: {}
      })
    ).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(
      await rig.generation.generate({ lessonId: 'les_nope', text: 'x', documentIds: [], meta: {} })
    ).toMatchObject({ ok: false, code: 'not-found' })
    const gate = rig.service.jobs.start(rig.lessonId, 'chat', 'msg_x')
    expect(gate.ok).toBe(true)
    expect(
      await rig.generation.generate({
        lessonId: rig.lessonId,
        text: 'x',
        documentIds: [],
        meta: {}
      })
    ).toMatchObject({ ok: false, code: 'invalid-input' })
  })
})

describe('writing: order and parallelism', () => {
  function tracked(delays: (index: number) => number) {
    const log = {
      started: [] as number[],
      finished: [] as number[],
      inFlight: 0,
      maxInFlight: 0,
      firstAlone: true
    }
    const ai: Partial<AiService> = {
      writeSlide: async (input, opts) => {
        if (input.index === log.started[0] || log.started.length === 0)
          log.firstAlone = log.inFlight === 0
        else if (log.finished.length === 0) log.firstAlone = false
        log.started.push(input.index)
        log.maxInFlight = Math.max(log.maxInFlight, ++log.inFlight)
        await sleep(delays(input.index))
        log.inFlight--
        log.finished.push(input.index)
        return base.writeSlide(input, opts)
      }
    }
    return { log, ai }
  }

  it('writes the first slide alone, then at most 3 at a time', async () => {
    const { log, ai } = tracked(() => 15)
    const rig = await makeGenerationRig({ ai })
    await run(rig, TEXT, { targetSlideCount: 8 })
    expect(log.started).toHaveLength(8)
    expect(log.started[0]).toBe(0)
    expect(log.finished[0]).toBe(0)
    expect(log.firstAlone).toBe(true)
    expect(log.maxInFlight).toBe(3)
  })

  it('may finish out of order but the deck follows the plan', async () => {
    const { log, ai } = tracked((i) => (i === 1 ? 60 : 5))
    const rig = await makeGenerationRig({ ai })
    await run(rig, TEXT, { targetSlideCount: 8 })
    expect(log.finished.indexOf(1)).toBeGreaterThan(log.finished.indexOf(2))
    const opened = await slidesOf(rig)
    const ready = rig.of('slide-ready') as Array<{ index: number; slide: { id: string } }>
    expect(ready.map((r) => r.index)[0]).toBe(0)
    ready.forEach((r) => expect(opened.deck.slides[r.index].id).toBe(r.slide.id))
  })

  it('honours a different concurrency', async () => {
    const { log, ai } = tracked(() => 10)
    const rig = await makeGenerationRig({ ai, deps: { concurrency: 2 } })
    await run(rig)
    expect(log.maxInFlight).toBe(2)
  })
})

describe('stopping', () => {
  /** Stops the job right after `after` slides were written. */
  function stopAfter(rig: () => GenerationRig, after: number) {
    let written = 0
    const ai: Partial<AiService> = {
      writeSlide: async (input, opts) => {
        if (opts?.signal?.aborted) return cancelledFailure()
        const result = await base.writeSlide(input, opts)
        if (++written === after) {
          const job = rig().service.jobs.running(rig().lessonId)
          if (job) rig().generation.cancel(job.id)
        }
        return result
      }
    }
    return ai
  }

  it('keeps the finished slides as one undo step and says how many were made', async () => {
    let rig!: GenerationRig
    rig = await makeGenerationRig({ ai: stopAfter(() => rig, 3), deps: { concurrency: 1 } })
    await run(rig, TEXT, { targetSlideCount: 8 })
    const opened = await slidesOf(rig)
    expect(opened.deck.slides).toHaveLength(3)
    expect(opened.history.undoSummary).toBe('Made 3 slides')
    const progress = rig.of('gen-progress') as GenProgress[]
    expect(progress.at(-1)).toEqual({
      lessonId: rig.lessonId,
      stage: 'error',
      done: 3,
      total: 8,
      message: 'Stopped after 3 of 8 slides.'
    })
    expect(rig.names()).toContain('chat:changes')
    expect(rig.names().at(-1)).toBe('chat:done')
    expect(rig.names()).not.toContain('ai:error')
    const record = await rig.service.getGenerationRecord(rig.lessonId)
    expect(record).toMatchObject({ stoppedBy: 'cancelled' })
    expect(record?.slideIds.filter((id) => id !== null)).toHaveLength(3)
  })

  it('Stop while planning changes nothing and keeps no plan', async () => {
    let rig!: GenerationRig
    rig = await makeGenerationRig({
      ai: {
        planLesson: async (_input, opts) => {
          const job = rig.service.jobs.running(rig.lessonId)
          if (job) rig.generation.cancel(job.id)
          return opts?.signal?.aborted ? cancelledFailure() : ok({ plan: {} as LessonPlan })
        }
      }
    })
    await run(rig)
    expect((await slidesOf(rig)).deck.slides).toHaveLength(0)
    expect(await rig.service.getGenerationRecord(rig.lessonId)).toBeUndefined()
    const progress = rig.of('gen-progress') as GenProgress[]
    expect(progress.at(-1)).toMatchObject({
      stage: 'error',
      message: 'Stopped. Nothing was changed.'
    })
    const items = await historyOf(rig)
    expect(items.at(-1)?.error).toEqual({
      code: 'cancelled',
      message: 'Stopped. Nothing was changed.'
    })
  })

  it('"Finish the rest" writes only the missing slides in plan order, as another undo step', async () => {
    let rig!: GenerationRig
    rig = await makeGenerationRig({ ai: stopAfter(() => rig, 3), deps: { concurrency: 1 } })
    await run(rig, TEXT, { targetSlideCount: 8 })
    const firstThree = (await slidesOf(rig)).deck.slides.map((s) => s.id)

    const writes: number[] = []
    rig.ai.writeSlide = async (input, opts) => {
      writes.push(input.index)
      return base.writeSlide(input, opts)
    }
    const started = await rig.generation.finish(rig.lessonId)
    if (!started.ok) throw new Error(started.message)
    await rig.generation.whenDone(started.jobId)

    expect(writes).toEqual([3, 4, 5, 6, 7])
    const opened = await slidesOf(rig)
    expect(opened.deck.slides).toHaveLength(8)
    expect(opened.deck.slides.slice(0, 3).map((s) => s.id)).toEqual(firstThree)
    expect(opened.deck.slides.map((s) => s.kind).slice(3)).toEqual([
      'content',
      'content',
      'question',
      'check',
      'exit-ticket'
    ])
    expect(opened.history.undoSummary).toBe('Made 5 slides')
    expect(await rig.service.getGenerationRecord(rig.lessonId)).toBeUndefined()
    expect(await rig.generation.finish(rig.lessonId)).toMatchObject({
      ok: false,
      message: NOTHING_TO_FINISH
    })
    const undone = await rig.service.undo(rig.lessonId)
    expect(undone.ok && undone.deck.slides).toHaveLength(3)
  })
})

describe('failing', () => {
  it('keeps what is finished and offers "Finish the rest"', async () => {
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) =>
          input.index === 4 ? aiFailure('network') : base.writeSlide(input, opts)
      },
      deps: { concurrency: 1 }
    })
    await run(rig, TEXT, { targetSlideCount: 8 })
    expect((await slidesOf(rig)).deck.slides).toHaveLength(4)
    expect(rig.of('ai:error')).toEqual([
      {
        scope: 'generation',
        code: 'network',
        message: '4 of 8 slides made — Finish the rest?',
        retryable: true
      }
    ])
    const items = await historyOf(rig)
    expect(items.at(-1)).toMatchObject({
      error: { code: 'network', action: 'finish' },
      result: { label: '4 slides added' }
    })
    expect(await rig.service.getGenerationRecord(rig.lessonId)).toMatchObject({
      stoppedBy: 'error'
    })
  })

  it('the other slides in flight when one fails are kept too', async () => {
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          await sleep(input.index === 1 ? 5 : 30)
          return input.index === 1 ? aiFailure('overloaded') : base.writeSlide(input, opts)
        }
      }
    })
    await run(rig, TEXT, { targetSlideCount: 8 })
    const slides = (await slidesOf(rig)).deck.slides
    expect(slides.length).toBeGreaterThanOrEqual(3)
    expect(slides.length).toBeLessThan(8)
  })

  it.each([
    ['no-key', 'settings'],
    ['no-credit', 'console']
  ] as const)('a %s failure while planning changes nothing and offers %s', async (code, action) => {
    const rig = await makeGenerationRig({ fake: { failWith: code } })
    await run(rig)
    expect((await slidesOf(rig)).deck.slides).toHaveLength(0)
    expect(rig.of('ai:error')).toEqual([expect.objectContaining({ scope: 'generation', code })])
    const items = await historyOf(rig)
    expect(items.at(-1)?.error?.action).toBe(action)
    expect(await rig.service.getGenerationRecord(rig.lessonId)).toBeUndefined()
    expect(await rig.generation.finish(rig.lessonId)).toMatchObject({
      ok: false,
      code: 'not-found'
    })
  })

  it('offers Retry (not Finish) when the failure came before a plan existed', async () => {
    const rig = await makeGenerationRig({ fake: { failWith: 'network' } })
    await run(rig)
    const items = await historyOf(rig)
    expect(items.at(-1)?.error?.action).toBe('retry')
  })

  it('an AI exception becomes a friendly error and releases the lesson', async () => {
    const rig = await makeGenerationRig({
      ai: {
        planLesson: async () => {
          throw new Error('boom')
        }
      }
    })
    await run(rig)
    expect(rig.service.jobs.running(rig.lessonId)).toBeUndefined()
    expect((rig.of('gen-progress') as GenProgress[]).at(-1)?.stage).toBe('error')
  })
})

describe('plan validation', () => {
  const plan = (over: Partial<LessonPlan> = {}): LessonPlan => ({
    title: 'T',
    summary: 'S',
    slides: [
      { kind: 'title', layoutId: 'title', purpose: 'a', keyContent: [], objectiveRefs: [0, 1, 2] },
      {
        kind: 'content',
        layoutId: 'content-text-left-image-right',
        purpose: 'b',
        keyContent: [],
        objectiveRefs: []
      }
    ],
    ...over
  })

  it('asks once more, naming the problems, when objectives are not covered', async () => {
    const briefs: string[] = []
    let calls = 0
    const rig = await makeGenerationRig({
      ai: {
        planLesson: async (input) => {
          briefs.push(input.brief.context ?? '')
          return ok({ plan: calls++ === 0 ? plan({ slides: [plan().slides[1]] }) : plan() })
        }
      }
    })
    await run(rig)
    expect(calls).toBe(2)
    expect(briefs[1]).toContain('Objective 0')
    expect((await slidesOf(rig)).deck.slides).toHaveLength(2)
  })

  it('repairs layout ids that the style does not have without asking again', async () => {
    let calls = 0
    const written: string[] = []
    const rig = await makeGenerationRig({
      ai: {
        planLesson: async () => {
          calls++
          return ok({
            plan: plan({ slides: plan().slides.map((s) => ({ ...s, layoutId: 'nope' })) })
          })
        },
        writeSlide: async (input, opts) => {
          written.push(input.plan.slides[input.index].layoutId)
          return base.writeSlide(input, opts)
        }
      }
    })
    await run(rig)
    expect(calls).toBe(1)
    expect(written.every((id) => id !== 'nope')).toBe(true)
  })

  it('stops before writing when the plan is still not valid after the second try', async () => {
    let calls = 0
    let writes = 0
    const rig = await makeGenerationRig({
      ai: {
        planLesson: async () => (calls++, ok({ plan: plan({ slides: [plan().slides[1]] }) })),
        writeSlide: async (input, opts) => (writes++, base.writeSlide(input, opts))
      }
    })
    await run(rig)
    expect(calls).toBe(2)
    expect(writes).toBe(0)
    expect((await slidesOf(rig)).deck.slides).toHaveLength(0)
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({
        message: 'I couldn’t plan that lesson cleanly. Nothing was changed. Try again.'
      })
    ])
  })

  it('checks the slide count against the target (within 2)', async () => {
    let calls = 0
    const rig = await makeGenerationRig({
      ai: { planLesson: async () => (calls++, ok({ plan: plan() })) }
    })
    await run(rig, TEXT, { targetSlideCount: 8 })
    expect(calls).toBe(2)
    expect((await slidesOf(rig)).deck.slides).toHaveLength(0)
  })
})

describe('slides that Claude writes badly', () => {
  it('gives a duplicate or empty id a fresh one', async () => {
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          const written = await base.writeSlide(input, opts)
          return written.ok ? ok({ slide: { ...written.slide, id: 'same' } }) : written
        }
      }
    })
    await run(rig, TEXT, { targetSlideCount: 8 })
    const ids = (await slidesOf(rig)).deck.slides.map((s) => s.id)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
    expect(ids).toContain('same')
  })

  it('retries an invalid slide once, then stops with a clear message', async () => {
    let attempts = 0
    const rig = await makeGenerationRig({
      ai: {
        writeSlide: async (input, opts) => {
          if (input.index !== 2) return base.writeSlide(input, opts)
          attempts++
          const written = await base.writeSlide(input, opts)
          return written.ok
            ? ok({ slide: { ...written.slide, kind: 'nonsense' as never } })
            : written
        }
      },
      deps: { concurrency: 1 }
    })
    await run(rig, TEXT, { targetSlideCount: 8 })
    expect(attempts).toBe(2)
    expect((await slidesOf(rig)).deck.slides).toHaveLength(2)
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ message: '2 of 8 slides made — Finish the rest?' })
    ])
  })
})
