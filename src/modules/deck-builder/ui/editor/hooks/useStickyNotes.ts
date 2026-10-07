import { useCallback, useRef, useState } from 'react'
import { DECK_BUILDER, type EditorApi, type StickyNote } from '@shared/contracts/deck-builder'
import { newId } from '@shared/ids'
import { useClient } from '@renderer/sdk'

export interface StickyNotes {
  notes: StickyNote[]
  /** Places a new empty note and returns its id (it is saved once it has text). */
  add(slideId: string, at: { x: number; y: number }): string
  /** Types in a note: kept on screen at once, saved on `commit`. */
  edit(id: string, text: string): void
  /** The teacher left a note: empty ones are removed, the rest is saved. */
  commit(id: string): void
  remove(id: string): void
}

/**
 * The teacher's private notes on slides (06 §8.2): stored with the lesson, never exported or sent to Claude. They are
 * not part of the deck, so they are not undoable; saving is quiet and a failure only leaves them unsaved.
 */
export function useStickyNotes(lessonId: string, initial: readonly StickyNote[]): StickyNotes {
  const client = useClient<EditorApi>(DECK_BUILDER)
  const [notes, setNotes] = useState<StickyNote[]>([...initial])
  const latest = useRef(notes)
  latest.current = notes

  const save = useCallback(
    (next: StickyNote[]) => {
      latest.current = next
      setNotes(next)
      void client
        .setStickyNotes({ lessonId, notes: next.filter((note) => note.text.trim()) })
        .catch(() => {})
    },
    [client, lessonId]
  )

  const add = useCallback((slideId: string, at: { x: number; y: number }) => {
    const note: StickyNote = {
      id: newId('note'),
      slideId,
      x: Math.round(Math.min(Math.max(at.x, 0), 1920 - 360)),
      y: Math.round(Math.min(Math.max(at.y, 0), 1080 - 220)),
      text: ''
    }
    latest.current = [...latest.current, note]
    setNotes(latest.current)
    return note.id
  }, [])

  const edit = useCallback((id: string, text: string) => {
    latest.current = latest.current.map((note) => (note.id === id ? { ...note, text } : note))
    setNotes(latest.current)
  }, [])

  const commit = useCallback(
    (id: string) => {
      const note = latest.current.find((n) => n.id === id)
      if (!note) return
      save(note.text.trim() ? latest.current : latest.current.filter((n) => n.id !== id))
    },
    [save]
  )

  const remove = useCallback(
    (id: string) => save(latest.current.filter((note) => note.id !== id)),
    [save]
  )

  return { notes, add, edit, commit, remove }
}
