import { describe, expect, it } from 'vitest'
import { advance, presentKey, retreat, startShow, type PresentAction } from './presentKeys'

const state = (action: PresentAction) => {
  if (action?.kind !== 'state') throw new Error('expected a state')
  return action.state
}

describe('advance / retreat', () => {
  it('goes forward, then to the end screen after the last slide', () => {
    expect(advance(startShow(0), 3).index).toBe(1)
    const last = advance(startShow(2), 3)
    expect(last.ended).toBe(true)
    expect(last.index).toBe(2)
  })

  it('does nothing further from the end screen', () => {
    const ended = advance(startShow(2), 3)
    expect(advance(ended, 3).ended).toBe(true)
  })

  it('goes back, and from the end screen returns to the last slide', () => {
    expect(retreat(startShow(2), 3).index).toBe(1)
    expect(retreat(startShow(0), 3).index).toBe(0)
    const back = retreat(advance(startShow(2), 3), 3)
    expect(back).toMatchObject({ ended: false, index: 2 })
  })

  it('clears a black screen and typed digits', () => {
    const black = { ...startShow(0), screen: 'black' as const, digits: '4' }
    expect(advance(black, 3)).toMatchObject({ screen: 'slide', digits: '' })
  })
})

describe('presentKey', () => {
  it.each(['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n', 'N'])('%j advances', (key) => {
    expect(state(presentKey(startShow(0), key, 3)).index).toBe(1)
  })

  it.each(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])('%j goes back', (key) => {
    expect(state(presentKey(startShow(2), key, 3)).index).toBe(1)
  })

  it('Escape exits', () => {
    expect(presentKey(startShow(1), 'Escape', 3)).toEqual({ kind: 'exit' })
  })

  it('Home and End jump to the ends', () => {
    expect(state(presentKey(startShow(1), 'Home', 5)).index).toBe(0)
    expect(state(presentKey(startShow(1), 'End', 5)).index).toBe(4)
  })

  it('digits then Enter jump to that slide, clamped to the deck', () => {
    let s = state(presentKey(startShow(0), '2', 5))
    expect(s.digits).toBe('2')
    s = state(presentKey(s, 'Enter', 5))
    expect(s).toMatchObject({ index: 1, digits: '' })
    const big = state(presentKey(state(presentKey(startShow(0), '9', 5)), 'Enter', 5))
    expect(big.index).toBe(4)
    const zero = state(presentKey(state(presentKey(startShow(2), '0', 5)), 'Enter', 5))
    expect(zero.index).toBe(0)
  })

  it('keeps at most three digits', () => {
    let s = startShow(0)
    for (const key of ['1', '2', '3', '4']) s = state(presentKey(s, key, 500))
    expect(s.digits).toBe('123')
  })

  it('B and W toggle a black or white screen', () => {
    const black = state(presentKey(startShow(0), 'b', 3))
    expect(black.screen).toBe('black')
    expect(state(presentKey(black, '.', 3)).screen).toBe('slide')
    const white = state(presentKey(startShow(0), 'W', 3))
    expect(white.screen).toBe('white')
    expect(state(presentKey(white, ',', 3)).screen).toBe('slide')
  })

  it('ignores other keys', () => {
    expect(presentKey(startShow(0), 'x', 3)).toBeNull()
  })
})
