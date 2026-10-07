import { describe, expect, it } from 'vitest'
import { QUIZ_MANIFEST } from '../../../../renderer/src/ui/plugin/fixtures'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import {
  NO_REGION_REASON,
  NO_SLIDES_REASON,
  WAIT_REASON,
  requestSummary,
  runContext,
  slideContextOf,
  unavailableReason
} from './logic'

const deck = { slides: ['s1', 's2', 's3', 's4'].map((id) => ({ id })) } as never

describe('unavailableReason', () => {
  const lesson = { needsSlides: true, scope: 'lesson' as const }
  const state = { busy: false, slideCount: 4, regionCount: 0 }

  it('lets a plugin run when nothing stops it', () => {
    expect(unavailableReason(lesson, state)).toBeNull()
  })

  it('waits while a job runs, before anything else', () => {
    expect(unavailableReason(lesson, { ...state, busy: true, slideCount: 0 })).toBe(WAIT_REASON)
  })

  it('needs slides only when the plugin does', () => {
    expect(unavailableReason(lesson, { ...state, slideCount: 0 })).toBe(NO_SLIDES_REASON)
    expect(
      unavailableReason({ ...lesson, needsSlides: false }, { ...state, slideCount: 0 })
    ).toBeNull()
  })

  it('needs a circled region for region plugins', () => {
    const region = { needsSlides: true, scope: 'region' as const }
    expect(unavailableReason(region, state)).toBe(NO_REGION_REASON)
    expect(unavailableReason(region, { ...state, regionCount: 1 })).toBeNull()
  })
})

describe('slideContextOf', () => {
  it('numbers the current and selected slides from 1', () => {
    expect(slideContextOf(deck, ['s2', 's4'], 's2')).toEqual({
      total: 4,
      current: 2,
      selected: [2, 4]
    })
  })

  it('falls back to the current slide when nothing is selected, and to slide 1 when there is none', () => {
    expect(slideContextOf(deck, [], 's3')).toEqual({ total: 4, current: 3, selected: [3] })
    expect(slideContextOf(deck, [], null)).toEqual({ total: 4, current: 1, selected: [1] })
  })

  it('handles an empty deck', () => {
    expect(slideContextOf({ slides: [] }, [], null)).toEqual({
      total: 0,
      current: 1,
      selected: [1]
    })
  })
})

describe('runContext', () => {
  const region = { id: 'r1', n: 1, slideId: 's2' } as RegionDraft

  it('sends the current and selected slide ids, and regions only when there are some', () => {
    expect(runContext(deck, ['s2', 's3'], 's2', [])).toEqual({
      currentSlideId: 's2',
      selectedSlideIds: ['s2', 's3']
    })
    expect(runContext(deck, ['s2'], 's2', [region]).regions).toEqual([region])
  })

  it('drops ids that are not in the deck and falls back to the first slide', () => {
    expect(runContext(deck, ['gone'], 'gone', [])).toEqual({
      currentSlideId: 's1',
      selectedSlideIds: ['s1']
    })
  })
})

describe('requestSummary', () => {
  it('words the quiz request as in the design (07 §5)', () => {
    const slides = { total: 8, current: 3, selected: [3] }
    const values = {
      slides: 'all',
      count: 10,
      types: ['multiple-choice', 'true-false'],
      difficulty: 'mixed',
      destination: 'slides'
    }
    expect(requestSummary(QUIZ_MANIFEST, values, slides)).toBe(
      '10 questions · All 8 slides · Mixed · Slides at the end of this lesson'
    )
  })

  it('skips values it cannot word', () => {
    expect(
      requestSummary(
        { inputs: [{ id: 'x', type: 'boolean', label: 'X', default: true }] },
        {},
        {
          total: 1,
          current: 1,
          selected: [1]
        }
      )
    ).toBe('')
  })
})
