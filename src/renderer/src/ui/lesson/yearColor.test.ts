import { describe, expect, it } from 'vitest'
import { yearColor } from './yearColor'

describe('yearColor', () => {
  it.each([
    ['Year 7', 'var(--year-7)'],
    ['Year 8', 'var(--year-8)'],
    ['Y9', 'var(--year-9)'],
    ['year 10', 'var(--year-10)'],
    ['Yr 11', 'var(--year-11)'],
    ['8', 'var(--year-8)'],
    ['Year 12', 'var(--year-sixth-form)'],
    ['13', 'var(--year-sixth-form)'],
    ['Sixth form', 'var(--year-sixth-form)'],
    ['Form', 'var(--year-form)'],
    ['Form time', 'var(--year-form)'],
    ['Tutor group', 'var(--year-form)']
  ])('%s -> %s', (tag, colour) => {
    expect(yearColor(tag)).toBe(colour)
  })

  it.each([[null], [undefined], [''], ['  '], ['Reception'], ['Year 3'], ['Year 14']])(
    'falls back to white for %s',
    (tag) => {
      expect(yearColor(tag)).toBe('var(--white)')
    }
  )
})
