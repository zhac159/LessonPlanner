import { useEffect, useRef, type KeyboardEvent } from 'react'

export interface InlineTextEditorProps {
  /** Box of the text on the stage, in pixels. */
  box: { left: number; top: number; width: number; height: number }
  initial: string
  /** Font size in pixels, matched to the text it replaces. */
  fontPx: number
  label: string
  /** Called once with the final text: Esc, Ctrl+Enter or clicking away all commit (06 §8.2). */
  onCommit(text: string): void
}

/**
 * A text box edited in place on the stage. The whole text is selected when editing an existing element and the box
 * is empty for a new one. Enter adds a line; it never leaves the box, only Esc, Ctrl+Enter or a click elsewhere do.
 */
export function InlineTextEditor({ box, initial, fontPx, label, onCommit }: InlineTextEditorProps) {
  const field = useRef<HTMLTextAreaElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])

  const finish = (): void => {
    if (finished.current) return
    finished.current = true
    onCommit(field.current?.value ?? initial)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault()
      event.stopPropagation()
      // Keep the keyboard on the stage, not on the page, once the box is gone.
      const stage = event.currentTarget.closest<HTMLElement>('.stage-pane')
      finish()
      stage?.focus()
    }
  }

  return (
    <textarea
      ref={field}
      className="inline-text-editor"
      aria-label={label}
      defaultValue={initial}
      spellCheck
      style={{ ...box, fontSize: fontPx, lineHeight: 1.25 }}
      onBlur={finish}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => event.stopPropagation()}
    />
  )
}
