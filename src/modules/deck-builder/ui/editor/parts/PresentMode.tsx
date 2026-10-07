import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { SlideView } from '@ui/slide'
import { advance, presentKey, retreat, startShow, type PresentState } from '../logic/presentKeys'
import './PresentMode.css'

export interface PresentModeProps {
  slides: ReadonlyArray<Slide>
  styleProfile: StyleProfile | null
  /** The slide the show starts on. */
  startIndex: number
  /** Esc, the exit button or a click on the end screen; `index` is the slide she was on. */
  onExit(index: number): void
}

/** How long the control bar and the cursor stay after the mouse stops (06 §8.12). */
export const IDLE_MS = 2000

/**
 * The slide show (06 §8.12): a black full-window layer with the slide letterboxed, no annotations, no sticky notes and
 * no "doesn't fit" badges. It owns the keyboard while it is up (the editor's shortcuts never see it). The window itself
 * goes full screen through the screen's `present` calls, not here.
 */
export function PresentMode({ slides, styleProfile, startIndex, onExit }: PresentModeProps) {
  const total = slides.length
  const [state, setState] = useState<PresentState>(() =>
    startShow(Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0)))
  )
  const [awake, setAwake] = useState(true)
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(state)
  latest.current = state

  const wake = useCallback(() => {
    setAwake(true)
    clearTimeout(idle.current)
    idle.current = setTimeout(() => setAwake(false), IDLE_MS)
  }, [])

  useEffect(() => {
    wake()
    return () => clearTimeout(idle.current)
  }, [wake])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = presentKey(latest.current, event.key, total)
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      if (action.kind === 'exit') onExit(latest.current.index)
      else setState(action.state)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [total, onExit])

  const slide = slides[state.index]
  const onClick = (): void => {
    if (state.ended) onExit(Math.max(total - 1, 0))
    else setState(advance(state, total))
  }

  return createPortal(
    <div
      className="present"
      data-screen={state.screen}
      data-idle={!awake || undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Slide show"
      onMouseMove={wake}
      onClick={onClick}
    >
      {state.screen === 'slide' && !state.ended && slide && (
        <div className="present__slide">
          <SlideView slide={slide} style={styleProfile} aria-label={`Slide ${state.index + 1}`} />
        </div>
      )}
      {state.screen === 'slide' && state.ended && (
        <p className="present__end">End of slide show. Click or press Esc to exit.</p>
      )}
      {state.digits && (
        <p className="present__digits" role="status">
          {state.digits}
        </p>
      )}
      <div className="present__bar" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="present__button"
          aria-label="Previous slide"
          disabled={state.index === 0 && !state.ended}
          onClick={() => setState(retreat(state, total))}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="present__count" aria-live="polite">
          {Math.min(state.index + 1, total)} / {total}
        </span>
        <button
          type="button"
          className="present__button"
          aria-label="Next slide"
          disabled={state.ended}
          onClick={() => setState(advance(state, total))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="present__button"
          aria-label="Exit slide show"
          onClick={() => onExit(state.index)}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  )
}
