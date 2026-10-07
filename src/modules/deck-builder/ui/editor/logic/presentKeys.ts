/**
 * Present mode keys (06 §8.12). Pure: a key press and the state of the show give the next state.
 */

/** The show: which slide, whether the end screen or a black/white screen is up, digits typed for "go to". */
export interface PresentState {
  index: number
  ended: boolean
  screen: 'slide' | 'black' | 'white'
  digits: string
}

export type PresentAction = { kind: 'state'; state: PresentState } | { kind: 'exit' } | null

export const startShow = (index: number): PresentState => ({
  index,
  ended: false,
  screen: 'slide',
  digits: ''
})

const NEXT = new Set(['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n', 'N'])
const PREVIOUS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])

/** One step forward: past the last slide the end screen shows. */
export function advance(state: PresentState, total: number): PresentState {
  const cleared = { ...state, screen: 'slide' as const, digits: '' }
  if (state.ended) return cleared
  if (state.index >= total - 1) return { ...cleared, ended: true }
  return { ...cleared, index: state.index + 1 }
}

/** One step back; from the end screen it returns to the last slide. */
export function retreat(state: PresentState, total: number): PresentState {
  const cleared = { ...state, screen: 'slide' as const, digits: '' }
  if (state.ended) return { ...cleared, ended: false, index: Math.max(total - 1, 0) }
  return { ...cleared, index: Math.max(state.index - 1, 0) }
}

/** What a key does. `total` is the number of slides. */
export function presentKey(state: PresentState, key: string, total: number): PresentAction {
  if (key === 'Escape') return { kind: 'exit' }
  if (/^[0-9]$/.test(key)) {
    return { kind: 'state', state: { ...state, digits: `${state.digits}${key}`.slice(0, 3) } }
  }
  if (key === 'Enter' && state.digits) {
    const target = Math.min(Math.max(Number(state.digits), 1), total) - 1
    return { kind: 'state', state: { ...startShow(target) } }
  }
  if (NEXT.has(key)) return { kind: 'state', state: advance(state, total) }
  if (PREVIOUS.has(key)) return { kind: 'state', state: retreat(state, total) }
  if (key === 'Home') return { kind: 'state', state: startShow(0) }
  if (key === 'End') return { kind: 'state', state: startShow(Math.max(total - 1, 0)) }
  if (key === 'b' || key === 'B' || key === '.') {
    return {
      kind: 'state',
      state: { ...state, screen: state.screen === 'black' ? 'slide' : 'black' }
    }
  }
  if (key === 'w' || key === 'W' || key === ',') {
    return {
      kind: 'state',
      state: { ...state, screen: state.screen === 'white' ? 'slide' : 'white' }
    }
  }
  return null
}
