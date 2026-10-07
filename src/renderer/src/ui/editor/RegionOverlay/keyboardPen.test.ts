import { describe, expect, it } from 'vitest'
import { initialPen, PEN_STEP, PEN_STEP_LARGE, penKey, type PenState } from './keyboardPen'

const press = (state: PenState, ...keys: string[]): PenState => {
  let current = state
  for (const key of keys) current = penKey(current, key, false).state
  return current
}

describe('keyboard pen', () => {
  it('starts in the middle of the slide with nothing drawn', () => {
    expect(initialPen()).toEqual({ cursor: [960, 540], stroke: null })
  })

  it('moves the cursor with arrows, a bigger step with Shift', () => {
    const moved = penKey(initialPen(), 'ArrowRight', false)
    expect(moved.handled).toBe(true)
    expect(moved.state.cursor).toEqual([960 + PEN_STEP, 540])
    expect(penKey(initialPen(), 'ArrowUp', true).state.cursor).toEqual([960, 540 - PEN_STEP_LARGE])
    expect(moved.state.stroke).toBeNull()
  })

  it('keeps the cursor on the slide', () => {
    let state = initialPen()
    for (let i = 0; i < 60; i++) state = press(state, 'ArrowLeft', 'ArrowUp')
    expect(state.cursor).toEqual([0, 0])
  })

  it('puts the pen down with Enter and adds a point per arrow press', () => {
    let state = press(initialPen(), 'Enter')
    expect(state.stroke).toEqual([[960, 540]])
    state = press(state, 'ArrowRight', 'ArrowDown')
    expect(state.stroke).toEqual([
      [960, 540],
      [1000, 540],
      [1000, 580]
    ])
  })

  it('completes the loop with a second Enter and reports the raw points', () => {
    const drawn = press(initialPen(), 'Enter', 'ArrowRight', 'ArrowDown', 'ArrowLeft')
    const outcome = penKey(drawn, 'Enter', false)
    expect(outcome.complete).toEqual(drawn.stroke)
    expect(outcome.state.stroke).toBeNull()
    expect(outcome.cancelled).toBeUndefined()
  })

  it('cancels a loop that has too few points', () => {
    const outcome = penKey(press(initialPen(), 'Enter'), 'Enter', false)
    expect(outcome.cancelled).toBe(true)
    expect(outcome.complete).toBeUndefined()
    expect(outcome.state.stroke).toBeNull()
  })

  it('cancels with Esc only while drawing', () => {
    const outcome = penKey(press(initialPen(), 'Enter', 'ArrowRight'), 'Escape', false)
    expect(outcome.cancelled).toBe(true)
    expect(outcome.state.stroke).toBeNull()
    const idle = penKey(initialPen(), 'Escape', false)
    expect(idle.handled).toBe(false)
    expect(idle.cancelled).toBeUndefined()
  })

  it('ignores other keys', () => {
    const outcome = penKey(initialPen(), 'a', false)
    expect(outcome.handled).toBe(false)
    expect(outcome.state).toEqual(initialPen())
  })
})
