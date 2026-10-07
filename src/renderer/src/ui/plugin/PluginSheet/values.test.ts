import { describe, expect, it } from 'vitest'
import type { PluginInput } from '@shared/contracts/deck-builder-plugins'
import { EIGHT_SLIDES, QUIZ_MANIFEST } from '../fixtures'
import {
  initialValues,
  progressLabel,
  reconcileSlideRanges,
  slideRangeOptions,
  validate,
  type SlideContext
} from './values'

const slides = (total: number, current: number, selected: number[] = [current]): SlideContext => ({
  total,
  current,
  selected
})

describe('slideRangeOptions', () => {
  it('offers All and Just this slide for one selected slide', () => {
    expect(slideRangeOptions(EIGHT_SLIDES)).toEqual([
      { value: 'all', label: 'All 8 slides' },
      { value: 'current', label: 'Just slide 3' }
    ])
  })

  it('adds a range for a contiguous multi-selection', () => {
    expect(slideRangeOptions(slides(8, 3, [3, 4, 5, 6, 7])).map((o) => o.label)).toEqual([
      'All 8 slides',
      'Slides 3–7',
      'Just slide 3'
    ])
  })

  it('counts a scattered multi-selection', () => {
    expect(slideRangeOptions(slides(8, 3, [7, 3, 5])).map((o) => o.label)).toContain(
      '3 selected slides'
    )
  })

  it('ignores duplicates in the selection', () => {
    expect(slideRangeOptions(slides(8, 3, [3, 3])).map((o) => o.value)).toEqual(['all', 'current'])
  })

  it('offers only "Just slide 1" in a one-slide lesson', () => {
    expect(slideRangeOptions(slides(1, 1))).toEqual([{ value: 'current', label: 'Just slide 1' }])
  })

  it('offers nothing for an empty lesson', () => {
    expect(slideRangeOptions(slides(0, 0, []))).toEqual([])
  })
})

describe('initialValues', () => {
  const inputs = QUIZ_MANIFEST.inputs

  it('uses the manifest defaults', () => {
    expect(initialValues(inputs, EIGHT_SLIDES)).toEqual({
      slides: 'all',
      count: 10,
      types: ['multiple-choice', 'true-false'],
      difficulty: 'mixed',
      destination: 'slides'
    })
  })

  it('selects the multi-selection option when several slides are selected', () => {
    expect(initialValues(inputs, slides(8, 3, [3, 4, 5])).slides).toBe('selected')
  })

  it('falls back to the only available slide range', () => {
    expect(initialValues(inputs, slides(1, 1)).slides).toBe('current')
  })

  it('overlays valid last-used values and ignores the old slide range', () => {
    const values = initialValues(inputs, EIGHT_SLIDES, {
      slides: 'current',
      count: 12,
      types: ['short-answer', 'multiple-choice'],
      difficulty: 'stretch',
      destination: 'both'
    })
    expect(values).toEqual({
      slides: 'all',
      count: 12,
      types: ['multiple-choice', 'short-answer'],
      difficulty: 'stretch',
      destination: 'both'
    })
  })

  it('ignores last-used values that no longer fit the manifest', () => {
    const values = initialValues(inputs, EIGHT_SLIDES, {
      count: 'lots',
      types: 'multiple-choice',
      difficulty: 'impossible',
      destination: 7
    })
    expect(values).toEqual(initialValues(inputs, EIGHT_SLIDES))
  })

  it('clamps a remembered number into the manifest range', () => {
    expect(initialValues(inputs, EIGHT_SLIDES, { count: 99 }).count).toBe(30)
    expect(initialValues(inputs, EIGHT_SLIDES, { count: 1 }).count).toBe(3)
  })

  it('handles text and boolean inputs', () => {
    const extra: PluginInput[] = [
      { id: 'note', type: 'text', label: 'Extra', maxLength: 5 },
      { id: 'answers', type: 'boolean', label: 'Answer slide', default: true }
    ]
    expect(initialValues(extra, EIGHT_SLIDES)).toEqual({ note: '', answers: true })
    expect(initialValues(extra, EIGHT_SLIDES, { note: 'abcdefgh', answers: false })).toEqual({
      note: 'abcde',
      answers: false
    })
    expect(initialValues(extra, EIGHT_SLIDES, { note: 3, answers: 'no' })).toEqual({
      note: '',
      answers: true
    })
  })

  it('treats missing or null last inputs as none', () => {
    expect(initialValues(inputs, EIGHT_SLIDES, null)).toEqual(initialValues(inputs, EIGHT_SLIDES))
  })
})

describe('reconcileSlideRanges', () => {
  const inputs = QUIZ_MANIFEST.inputs
  const base = initialValues(inputs, EIGHT_SLIDES)

  it('selects the new multi-selection option when it appears', () => {
    const next = reconcileSlideRanges(inputs, base, slides(8, 3, [3, 4, 5]), EIGHT_SLIDES)
    expect(next.slides).toBe('selected')
  })

  it('keeps a still-valid choice when the selection does not gain a range', () => {
    const next = reconcileSlideRanges(
      inputs,
      { ...base, slides: 'current' },
      slides(8, 4),
      EIGHT_SLIDES
    )
    expect(next.slides).toBe('current')
  })

  it('falls back when the chosen range disappears', () => {
    const multi = slides(8, 3, [3, 4, 5])
    const chosen = { ...base, slides: 'selected' }
    const next = reconcileSlideRanges(inputs, chosen, EIGHT_SLIDES, multi)
    expect(next.slides).toBe('all')
  })

  it('leaves other inputs alone', () => {
    const next = reconcileSlideRanges(inputs, base, slides(8, 3, [3, 4]), EIGHT_SLIDES)
    expect(next.count).toBe(10)
  })
})

describe('validate', () => {
  const inputs = QUIZ_MANIFEST.inputs
  const good = initialValues(inputs, EIGHT_SLIDES)

  it('accepts the defaults', () => {
    expect(validate(inputs, good, EIGHT_SLIDES)).toEqual({})
  })

  it('asks for at least one of a multi input', () => {
    expect(validate(inputs, { ...good, types: [] }, EIGHT_SLIDES)).toEqual({
      types: 'Pick at least one.'
    })
  })

  it('uses the manifest minimum for a larger requirement', () => {
    const input: PluginInput = {
      id: 'm',
      type: 'multi',
      label: 'M',
      options: [{ value: 'a', label: 'A' }],
      default: [],
      minSelected: 2
    }
    expect(validate([input], { m: ['a'] }, EIGHT_SLIDES)).toEqual({ m: 'Pick at least 2.' })
  })

  it('does not require anything of a multi input without a minimum', () => {
    const input: PluginInput = { id: 'm', type: 'multi', label: 'M', options: [], default: [] }
    expect(validate([input], { m: [] }, EIGHT_SLIDES)).toEqual({})
  })

  it('keeps numbers in range', () => {
    expect(validate(inputs, { ...good, count: 31 }, EIGHT_SLIDES).count).toBe(
      'Choose between 3 and 30.'
    )
    expect(validate(inputs, { ...good, count: 2 }, EIGHT_SLIDES).count).toBe(
      'Choose between 3 and 30.'
    )
    expect(validate(inputs, { ...good, count: 'x' }, EIGHT_SLIDES).count).toBeDefined()
  })

  it('rejects unknown choices', () => {
    expect(validate(inputs, { ...good, difficulty: 'nope' }, EIGHT_SLIDES).difficulty).toBe(
      'Choose one.'
    )
  })

  it('needs a slide range that exists', () => {
    expect(validate(inputs, { ...good, slides: 'selected' }, EIGHT_SLIDES).slides).toBeDefined()
    expect(validate(inputs, good, slides(0, 0, [])).slides).toBe('There are no slides to use.')
  })

  it('checks required and over-long text', () => {
    const text: PluginInput = { id: 't', type: 'text', label: 'T', required: true, maxLength: 4 }
    expect(validate([text], { t: '  ' }, EIGHT_SLIDES).t).toBe('Please fill this in.')
    expect(validate([text], { t: 'abcde' }, EIGHT_SLIDES).t).toBe(
      'Keep it to 4 characters or fewer.'
    )
    expect(validate([text], { t: 'abc' }, EIGHT_SLIDES)).toEqual({})
    const optional: PluginInput = { id: 't', type: 'text', label: 'T' }
    expect(validate([optional], { t: '' }, EIGHT_SLIDES)).toEqual({})
  })

  it('has nothing to check on a boolean', () => {
    const flag: PluginInput = { id: 'b', type: 'boolean', label: 'B', default: false }
    expect(validate([flag], { b: false }, EIGHT_SLIDES)).toEqual({})
  })
})

describe('progressLabel', () => {
  it('turns "Make quiz" into "Making quiz…"', () => {
    expect(progressLabel('Make quiz')).toBe('Making quiz…')
    expect(progressLabel('Make worksheet')).toBe('Making worksheet…')
  })

  it('adds an ellipsis to other verbs and never doubles it', () => {
    expect(progressLabel('Add notes')).toBe('Add notes…')
    expect(progressLabel('Add notes…')).toBe('Add notes…')
  })

  it('does not mistake words that merely start with "make"', () => {
    expect(progressLabel('Makeover')).toBe('Makeover…')
  })
})
