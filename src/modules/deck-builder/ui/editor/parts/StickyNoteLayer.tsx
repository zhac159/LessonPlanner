import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { StickyNote } from '@shared/contracts/deck-builder'
import './StickyNoteLayer.css'

const NOTE_WIDTH = 190

export interface StickyNoteLayerProps {
  /** The notes of the slide on the stage. */
  notes: ReadonlyArray<StickyNote>
  /** Stage size in pixels and pixels per slide unit. */
  box: { scale: number; width: number; height: number }
  /** A note just placed: its text field takes focus. */
  focusId: string | null
  onEdit(id: string, text: string): void
  /** The teacher left the note (empty ones disappear). */
  onCommit(id: string): void
  onRemove(id: string): void
}

function NoteCard({
  note,
  left,
  top,
  autofocus,
  onEdit,
  onCommit,
  onRemove
}: {
  note: StickyNote
  left: number
  top: number
  autofocus: boolean
} & Pick<StickyNoteLayerProps, 'onEdit' | 'onCommit' | 'onRemove'>) {
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (autofocus) field.current?.focus()
  }, [autofocus])
  return (
    <div className="sticky-note" style={{ left, top, width: NOTE_WIDTH }}>
      <textarea
        ref={field}
        className="sticky-note__text"
        aria-label="Sticky note"
        placeholder="Note to self…"
        rows={3}
        value={note.text}
        onChange={(event) => onEdit(note.id, event.target.value)}
        onBlur={() => onCommit(note.id)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            event.currentTarget.blur()
          }
        }}
      />
      <button
        type="button"
        className="sticky-note__remove"
        aria-label="Delete note"
        onClick={() => onRemove(note.id)}
      >
        <X size={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * The teacher's private notes on the slide (06 §8.2): small yellow cards "Note to self…" that are never exported or
 * sent to Claude. Drawn in pixels (not slide units) so their text stays readable at any stage size.
 */
export function StickyNoteLayer({
  notes,
  box,
  focusId,
  onEdit,
  onCommit,
  onRemove
}: StickyNoteLayerProps) {
  return (
    <div className="sticky-layer">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          left={Math.max(0, Math.min(note.x * box.scale, box.width - NOTE_WIDTH - 8))}
          top={Math.max(0, Math.min(note.y * box.scale, box.height - 96))}
          autofocus={note.id === focusId}
          onEdit={onEdit}
          onCommit={onCommit}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
