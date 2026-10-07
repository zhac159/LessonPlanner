import { describe, expect, it } from 'vitest'
import { dropTarget, nudgeTarget } from './reorder'

const ids = ['a', 'b', 'c', 'd']

describe('dropTarget', () => {
  it('moves a slide before the first one to the front', () => {
    expect(dropTarget(ids, 'c', 'a', 'before')).toBeNull()
  })

  it('moves a slide after another one', () => {
    expect(dropTarget(ids, 'a', 'c', 'after')).toBe('c')
    expect(dropTarget(ids, 'd', 'a', 'after')).toBe('a')
  })

  it('moves a slide before another one (after that one’s predecessor)', () => {
    expect(dropTarget(ids, 'd', 'b', 'before')).toBe('a')
  })

  it('moves a slide to the very end', () => {
    expect(dropTarget(ids, 'a', 'd', 'after')).toBe('d')
  })

  it.each([
    ['dropped on itself', 'b', 'b', 'before'],
    ['dropped just before where it already is', 'b', 'c', 'before'],
    ['dropped just after where it already is', 'b', 'a', 'after'],
    ['first slide before the second', 'a', 'b', 'before'],
    ['last slide after the one before it', 'd', 'c', 'after'],
    ['first slide before itself', 'a', 'a', 'before']
  ] as const)('does nothing when %s', (_name, drag, over, side) => {
    expect(dropTarget(ids, drag, over, side)).toBeUndefined()
  })

  it('ignores unknown ids', () => {
    expect(dropTarget(ids, 'zzz', 'a', 'before')).toBeUndefined()
    expect(dropTarget(ids, 'a', 'zzz', 'before')).toBeUndefined()
  })
})

describe('nudgeTarget', () => {
  it('moves one place earlier', () => {
    expect(nudgeTarget(ids, 'c', -1)).toBe('a')
    expect(nudgeTarget(ids, 'b', -1)).toBeNull()
  })

  it('moves one place later', () => {
    expect(nudgeTarget(ids, 'a', 1)).toBe('b')
    expect(nudgeTarget(ids, 'c', 1)).toBe('d')
  })

  it('stops at either end', () => {
    expect(nudgeTarget(ids, 'a', -1)).toBeUndefined()
    expect(nudgeTarget(ids, 'd', 1)).toBeUndefined()
  })

  it('ignores unknown ids and single-slide lists', () => {
    expect(nudgeTarget(ids, 'zzz', 1)).toBeUndefined()
    expect(nudgeTarget(['a'], 'a', 1)).toBeUndefined()
  })
})
