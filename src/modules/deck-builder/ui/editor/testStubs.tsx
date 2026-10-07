/**
 * Stand-ins for the editor's two neighbours (the chat panel and the circle layer), so the editor's tests do not depend
 * on their internals. Each test file mocks `../chat` and `../circle` with these. Not app code.
 */
import { vi } from 'vitest'
import type { CircleLayerExtras } from '../circle'
import type { EditorChatExtras } from '../chat'
import type { CircleLayerProps, EditorChatProps } from '../seams'

export const seen: {
  chat: (EditorChatProps & EditorChatExtras) | null
  circle: (CircleLayerProps & CircleLayerExtras) | null
} = { chat: null, circle: null }

export function ChatStub(props: EditorChatProps & EditorChatExtras) {
  seen.chat = props
  return (
    <aside aria-label="Chat stub">
      <button type="button" onClick={() => props.onHighlightSlides(['s2'])}>
        stub hover result
      </button>
      <button type="button" onClick={() => props.onHighlightSlides([])}>
        stub unhover result
      </button>
      {props.sheet}
      {props.spots && (
        <button type="button" onClick={props.spots.onFillFirst}>
          {`stub spots ${props.spots.count}`}
        </button>
      )}
    </aside>
  )
}

export function CircleStub(props: CircleLayerProps & CircleLayerExtras) {
  seen.circle = props
  return (
    <div data-testid="circle-layer" data-active={props.active || undefined}>
      <button
        type="button"
        onClick={() =>
          props.onAddRegion({
            id: `r${props.regions.length + 1}`,
            n: props.regions.length + 1,
            slideId: props.slide.id,
            path: [],
            bbox: { x: 0, y: 0, w: 10, h: 10 },
            targetElementIds: []
          })
        }
      >
        stub add region
      </button>
      <button type="button" onClick={props.onExit}>
        stub exit circle
      </button>
    </div>
  )
}

export const chatModule = { EditorChat: ChatStub }
export const circleModule = { CircleLayer: CircleStub }
export const resetStubs = (): void => {
  seen.chat = null
  seen.circle = null
  vi.clearAllMocks()
}
