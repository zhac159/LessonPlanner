import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { isPictureSpot } from '@shared/assets/spots'
import type { Element, Slide } from '@shared/deck/types'
import type { EditorTool } from '@ui/editor'
import { clientToSlide } from '@ui/lesson'
import { dragOffset, elementLabel, isDrag, selectableElements } from '../logic/elements'
import { editableText, editorFontUnits, isEditableText } from '../logic/textEdit'
import { InlineTextEditor } from './InlineTextEditor'
import './ElementLayer.css'

/** A text box being typed with the Text tool, not in the deck until it has text. */
export interface TextDraft {
  x: number
  y: number
}

export interface ElementLayerProps {
  slide: Slide
  /** Pixels per slide unit. */
  scale: number
  tool: EditorTool
  /** View-only while an AI job runs: elements can be picked but not changed. */
  readOnly: boolean
  selectedId: string | null
  /** The element whose text is being edited, if any. */
  editingId: string | null
  draft: TextDraft | null
  onSelect(id: string | null): void
  onStartEdit(id: string): void
  onCommitEdit(element: Element, text: string): void
  onCommitDraft(draft: TextDraft, text: string): void
  /** A drag finished: new position of the element. */
  onMove(element: Element, to: { x: number; y: number }): void
  /** The Text tool or the Sticky note tool was clicked on the empty stage. */
  onPlace(tool: 'text' | 'note', at: { x: number; y: number }): void
  /** A click on a picture spot (no drag) opens "Fill this picture spot" (A12). Without it spots only select. */
  onFillSpot?(elementId: string): void
}

interface Drag {
  id: string
  startX: number
  startY: number
  active: boolean
}

const px = (units: number, scale: number): number => Math.round(units * scale * 100) / 100

/**
 * The editable layer over the stage (06 §8.2): a transparent button over every element the teacher may pick, the
 * orange outline of the picked one, dragging, and the text box being edited. It sits under the circle layer and
 * only takes the pointer for the Select, Text and Sticky note tools.
 */
export function ElementLayer({
  slide,
  scale,
  tool,
  readOnly,
  selectedId,
  editingId,
  draft,
  onSelect,
  onStartEdit,
  onCommitEdit,
  onCommitDraft,
  onMove,
  onPlace,
  onFillSpot
}: ElementLayerProps) {
  const drag = useRef<Drag | null>(null)
  /** A box was just placed: the mouse-down that follows this pointer-down must not move focus. */
  const placing = useRef(false)
  const [offset, setOffset] = useState<{ id: string; x: number; y: number } | null>(null)
  const elements = selectableElements(slide)
  const passive = tool !== 'select'

  const pointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (tool === 'select') return onSelect(null)
    if (tool === 'text' || tool === 'note') {
      placing.current = true
      const rect = event.currentTarget.getBoundingClientRect()
      onPlace(tool, clientToSlide({ x: event.clientX, y: event.clientY }, rect))
    }
  }

  // Placing a box starts a field that takes focus on pointer-down; the browser's own mouse-down focus change (to the
  // stage) would blur it at once and discard the empty box, so that default is cancelled.
  const mouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (!placing.current) return
    placing.current = false
    event.preventDefault()
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>, element: Element): void => {
    onSelect(element.id)
    if (readOnly) return
    drag.current = { id: element.id, startX: event.clientX, startY: event.clientY, active: false }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const moveDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.active && !isDrag(dx, dy)) return
    current.active = true
    setOffset({ id: current.id, ...dragOffset(dx, dy, scale) })
  }
  const endDrag = (element: Element, cancelled: boolean): void => {
    const current = drag.current
    drag.current = null
    const moved = offset
    setOffset(null)
    if (current && !current.active && !cancelled && onFillSpot && isPictureSpot(element)) {
      return onFillSpot(element.id)
    }
    if (!current?.active || cancelled || !moved || (moved.x === 0 && moved.y === 0)) return
    onMove(element, { x: element.x + moved.x, y: element.y + moved.y })
  }

  const style = (element: Element): CSSProperties => {
    const shift = offset?.id === element.id ? offset : null
    return {
      left: px(element.x + (shift?.x ?? 0), scale),
      top: px(element.y + (shift?.y ?? 0), scale),
      width: px(element.w, scale),
      height: px(element.h, scale),
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined
    }
  }

  const editing = editingId ? slide.elements.find((el) => el.id === editingId) : undefined

  return (
    <div
      className="element-layer"
      data-tool={tool}
      onPointerDown={pointerDown}
      onMouseDown={mouseDown}
    >
      {elements.map((element) => {
        if (element.id === editingId) return null
        return (
          <button
            key={element.id}
            type="button"
            className="element-hit"
            style={style(element)}
            tabIndex={-1}
            aria-label={elementLabel(element)}
            aria-pressed={selectedId === element.id}
            data-element-id={element.id}
            data-passive={passive || undefined}
            data-dragging={offset?.id === element.id || undefined}
            onPointerDown={(event) => !passive && startDrag(event, element)}
            onPointerMove={moveDrag}
            onPointerUp={() => endDrag(element, false)}
            onPointerCancel={() => endDrag(element, true)}
            onDoubleClick={() => !readOnly && isEditableText(element) && onStartEdit(element.id)}
          />
        )
      })}
      {editing && isEditableText(editing) && (
        <InlineTextEditor
          box={{
            left: px(editing.x, scale),
            top: px(editing.y, scale),
            width: px(editing.w, scale),
            height: px(editing.h, scale)
          }}
          initial={editableText(editing)}
          fontPx={px(editorFontUnits(editing), scale)}
          label={`Edit ${elementLabel(editing)}`}
          onCommit={(text) => onCommitEdit(editing, text)}
        />
      )}
      {draft && (
        <InlineTextEditor
          box={{
            left: px(draft.x, scale),
            top: px(draft.y, scale),
            width: px(800, scale),
            height: px(120, scale)
          }}
          initial=""
          fontPx={px(40, scale)}
          label="New text box"
          onCommit={(text) => onCommitDraft(draft, text)}
        />
      )}
    </div>
  )
}
