import { describe, expect, it } from 'vitest'
import { makeSlide } from '@shared/deck/testing'
import {
  IDLE_GENERATION,
  pendingSlides,
  slidesWithLive,
  unfinishedSummary,
  withProgress,
  withSlide,
  type GenerationView
} from './generation'

const progress = (stage: string, done: number, total: number) =>
  ({ lessonId: 'les_1', stage, done, total }) as Parameters<typeof withProgress>[1]

describe('withProgress', () => {
  it('is running until done or error', () => {
    expect(withProgress(IDLE_GENERATION, progress('planning', 0, 0)).running).toBe(true)
    expect(withProgress(IDLE_GENERATION, progress('writing', 2, 8)).running).toBe(true)
    expect(withProgress(IDLE_GENERATION, progress('done', 8, 8)).running).toBe(false)
    expect(withProgress(IDLE_GENERATION, progress('error', 2, 8)).running).toBe(false)
  })

  it('clears held slides when a new run starts reading, and keeps them when it ends', () => {
    const held = withSlide(IDLE_GENERATION, { slide: makeSlide('x'), index: 0 })
    expect(withProgress(held, progress('reading', 0, 0)).live).toEqual([])
    expect(withProgress(held, progress('done', 1, 1)).live).toHaveLength(1)
  })
})

describe('withSlide / slidesWithLive', () => {
  it('keeps slides in plan order and replaces one at the same position', () => {
    let view: GenerationView = IDLE_GENERATION
    view = withSlide(view, { slide: makeSlide('s2'), index: 1 })
    view = withSlide(view, { slide: makeSlide('s1'), index: 0 })
    expect(view.live.map((l) => l.slide.id)).toEqual(['s1', 's2'])
    view = withSlide(view, { slide: makeSlide('s1b'), index: 0 })
    expect(view.live.map((l) => l.slide.id)).toEqual(['s1b', 's2'])
  })

  it('appends the generated slides the deck does not have yet', () => {
    const view = withSlide(withSlide(IDLE_GENERATION, { slide: makeSlide('a'), index: 0 }), {
      slide: makeSlide('b'),
      index: 1
    })
    expect(slidesWithLive([makeSlide('a')], view).map((s) => s.id)).toEqual(['a', 'b'])
    expect(slidesWithLive([], IDLE_GENERATION)).toEqual([])
  })
})

describe('pendingSlides', () => {
  it('counts the slides still to come while running', () => {
    const view = withProgress(IDLE_GENERATION, progress('writing', 2, 8))
    expect(pendingSlides(view)).toBe(6)
  })

  it('counts slides held live as done', () => {
    let view = withProgress(IDLE_GENERATION, progress('writing', 1, 8))
    view = withSlide(view, { slide: makeSlide('a'), index: 0 })
    view = withSlide(view, { slide: makeSlide('b'), index: 1 })
    view = withSlide(view, { slide: makeSlide('c'), index: 2 })
    expect(pendingSlides(view)).toBe(5)
  })

  it('is zero when idle or stopped', () => {
    expect(pendingSlides(IDLE_GENERATION)).toBe(0)
    expect(pendingSlides(withProgress(IDLE_GENERATION, progress('error', 2, 8)))).toBe(0)
  })
})

describe('unfinishedSummary', () => {
  it('reports a job that stopped early', () => {
    const view = withProgress(IDLE_GENERATION, progress('error', 5, 8))
    expect(unfinishedSummary(view)).toEqual({ done: 5, total: 8 })
  })

  it('is null while running, after success, with no plan or no progress', () => {
    expect(unfinishedSummary(withProgress(IDLE_GENERATION, progress('writing', 5, 8)))).toBeNull()
    expect(unfinishedSummary(withProgress(IDLE_GENERATION, progress('done', 8, 8)))).toBeNull()
    expect(unfinishedSummary(withProgress(IDLE_GENERATION, progress('error', 0, 0)))).toBeNull()
    expect(unfinishedSummary(IDLE_GENERATION)).toBeNull()
  })
})
