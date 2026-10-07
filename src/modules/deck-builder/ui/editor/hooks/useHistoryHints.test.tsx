import { render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it } from 'vitest'
import type { HistoryState } from '@shared/contracts/deck-builder'
import { historyHints, useHistoryHints } from './useHistoryHints'

const state = (patch: Partial<HistoryState> = {}): HistoryState => ({
  canUndo: false,
  canRedo: false,
  undoChangeSetId: null,
  redoChangeSetId: null,
  ...patch
})

describe('historyHints', () => {
  it('describes what undo and redo would do', () => {
    expect(
      historyHints(
        state({
          canUndo: true,
          undoSummary: 'Moved a slide',
          canRedo: true,
          redoSummary: 'Added a slide'
        })
      )
    ).toEqual({ undo: 'Undoes: Moved a slide', redo: 'Redoes: Added a slide' })
  })

  it('is empty when there is nothing to do or no summary', () => {
    expect(historyHints(state({ undoSummary: 'Old' }))).toEqual({ undo: '', redo: '' })
    expect(historyHints(state({ canUndo: true }))).toEqual({ undo: '', redo: '' })
  })
})

describe('useHistoryHints', () => {
  function Rail({ history }: { history: HistoryState }) {
    const ref = useRef<HTMLDivElement>(null)
    useHistoryHints(ref, history)
    return (
      <div ref={ref}>
        <button data-id="undo">Undo</button>
        <button data-id="redo">Redo</button>
      </div>
    )
  }

  it('sets and clears aria-description on the two buttons', () => {
    const { rerender, getByText } = render(
      <Rail history={state({ canUndo: true, undoSummary: 'Edited text' })} />
    )
    expect(getByText('Undo')).toHaveAttribute('aria-description', 'Undoes: Edited text')
    expect(getByText('Redo')).not.toHaveAttribute('aria-description')
    rerender(<Rail history={state()} />)
    expect(getByText('Undo')).not.toHaveAttribute('aria-description')
  })
})
