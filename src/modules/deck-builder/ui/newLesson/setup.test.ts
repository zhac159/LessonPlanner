import { describe, expect, it } from 'vitest'
import { detectDuration, detectYearGroup, normaliseYearGroup } from './detect'
import { initialSetup, setupReducer, setupSummary, slideCountForLength } from './setup'

describe('slideCountForLength', () => {
  it('follows the table of 05 §8.4', () => {
    const table: Array<[number, number]> = [
      [30, 6],
      [40, 6],
      [45, 8],
      [50, 8],
      [60, 10],
      [75, 12],
      [90, 15]
    ]
    for (const [minutes, slides] of table) expect(slideCountForLength(minutes)).toBe(slides)
  })
})

describe('setupReducer', () => {
  it('starts with 50 min, Mixed ability, about 8 slides and no year', () => {
    expect(initialSetup().values).toEqual({
      yearGroup: null,
      durationMin: 50,
      ability: 'Mixed ability',
      slideCount: 8
    })
  })

  it('applies preference defaults to chips still on their default', () => {
    const state = setupReducer(initialSetup(), {
      type: 'defaults',
      yearGroup: 'Year 9',
      durationMin: 60,
      ability: 'Higher ability'
    })
    expect(state.values).toEqual({
      yearGroup: 'Year 9',
      durationMin: 60,
      ability: 'Higher ability',
      slideCount: 10
    })
  })

  it('never lets a default overwrite a guess or a choice', () => {
    let state = setupReducer(initialSetup(), { type: 'detected', yearGroup: 'Year 8' })
    state = setupReducer(state, { type: 'user', key: 'ability', value: 'Lower ability' })
    state = setupReducer(state, {
      type: 'defaults',
      yearGroup: 'Year 10',
      ability: 'Higher ability'
    })
    expect(state.values.yearGroup).toBe('Year 8')
    expect(state.values.ability).toBe('Lower ability')
  })

  it('lets a guess update the chip until the teacher has changed it', () => {
    let state = setupReducer(initialSetup(), { type: 'detected', yearGroup: 'Year 8' })
    state = setupReducer(state, { type: 'detected', yearGroup: 'Year 9' })
    expect(state.values.yearGroup).toBe('Year 9')
    state = setupReducer(state, { type: 'user', key: 'year', value: 'Year 11' })
    state = setupReducer(state, { type: 'detected', yearGroup: 'Year 8' })
    expect(state.values.yearGroup).toBe('Year 11')
  })

  it('makes the slide count follow the length until she picks a count', () => {
    let state = setupReducer(initialSetup(), { type: 'user', key: 'length', value: 90 })
    expect(state.values.slideCount).toBe(15)
    state = setupReducer(state, { type: 'user', key: 'slides', value: 10 })
    state = setupReducer(state, { type: 'user', key: 'length', value: 30 })
    expect(state.values.slideCount).toBe(10)
    state = setupReducer(state, { type: 'detected', durationMin: 45 })
    expect(state.values.durationMin).toBe(30)
  })

  it('moves the slide count with a detected length', () => {
    const state = setupReducer(initialSetup(), { type: 'detected', durationMin: 75 })
    expect(state.values).toMatchObject({ durationMin: 75, slideCount: 12 })
  })
})

describe('setupSummary', () => {
  it('reads like the line under her message', () => {
    expect(
      setupSummary({
        yearGroup: 'Year 8',
        durationMin: 50,
        ability: 'Mixed ability',
        slideCount: 8
      })
    ).toBe('Year 8 · 50 min · Mixed ability · About 8 slides')
  })

  it('leaves out an unchosen year', () => {
    expect(setupSummary(initialSetup().values)).toBe('50 min · Mixed ability · About 8 slides')
  })
})

describe('detectYearGroup', () => {
  it.each([
    ['Photosynthesis, Y8 set 3', 'Year 8'],
    ['Year 10 forces', 'Year 10'],
    ['yr 9 recap', 'Year 9'],
    ['YEAR 13 biology', 'Year 13']
  ])('finds the year in %s', (text, year) => expect(detectYearGroup(text)).toBe(year))

  it.each(['Year 3 maths', 'Y2', 'my 8 slides', 'by 8am', 'Year 77', 'plenty'])(
    'ignores %s',
    (text) => expect(detectYearGroup(text)).toBeNull()
  )
})

describe('normaliseYearGroup', () => {
  it('uses the chip spelling', () => {
    expect(normaliseYearGroup('Y8')).toBe('Year 8')
    expect(normaliseYearGroup('8')).toBe('Year 8')
    expect(normaliseYearGroup('year 12')).toBe('Year 12')
    expect(normaliseYearGroup('form time')).toBe('Form time')
    expect(normaliseYearGroup('Reception')).toBeNull()
    expect(normaliseYearGroup(undefined)).toBeNull()
  })
})

describe('detectDuration', () => {
  it.each([
    ['a 50 minute lesson', 50],
    ['60 mins', 60],
    ['45min', 45],
    ['1 hour', null],
    ['5 minutes starter', null],
    ['LO1: in 3 minutes', null]
  ])('reads %s', (text, minutes) => expect(detectDuration(text)).toBe(minutes))
})
