import { useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Monitor } from 'lucide-react'
import type { StickyNote } from '@shared/contracts/deck-builder'
import { StagePreviewLayer } from '../../assets/parts/StagePreviewLayer'
import type { StagePreview } from '../../assets/logic/preview'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { Button, EmptyState } from '@ui/atoms'
import { isTextEntry, type EditorTool } from '@ui/editor'
import { SlideStage, slideLabel, type StageBox } from '@ui/lesson'
import type { StageEditing } from '../hooks/useStageEditing'
import type { StickyNotes } from '../hooks/useStickyNotes'
import { selectableElements } from '../logic/elements'
import { isEditableText } from '../logic/textEdit'
import { ElementLayer } from './ElementLayer'
import { StickyNoteLayer } from './StickyNoteLayer'
import './StagePane.css'

export interface StagePaneProps {
  slide: Slide | null
  /** 1-based position of the slide, for its accessible name. */
  slideNumber: number
  styleProfile: StyleProfile | null
  tool: EditorTool
  onToolChange(tool: EditorTool): void
  /** An AI job or generation is running: the stage is view-only (06 §7). */
  readOnly: boolean
  /** Slides are being made and none has arrived yet. */
  generating: boolean
  editing: StageEditing
  notes: StickyNotes
  /** The notes on this slide are listed here; the rest of the lesson's notes live in `notes`. */
  slideNotes: ReadonlyArray<StickyNote>
  /** PageUp / PageDown: another slide. */
  onStepSlide(delta: -1 | 1): void
  /** "Blank slide" in the empty lesson. */
  onAddBlank(): void
  /** More layers over the stage, such as the circle layer (it gets the stage size). */
  layers?: (box: StageBox) => ReactNode
  /** Pictures for the slide (the library's copies, by asset id). */
  resolveAsset?: (assetId: string) => string | undefined
  /** A11 / A13: the picture drawn at the frame it would get, in a dashed orange box. */
  preview?: StagePreview | null
  /** A click on a picture spot (or its button) opens "Fill this picture spot". */
  onFillSpot?(elementId: string): void
  stageRef: RefObject<HTMLDivElement | null>
}

/**
 * The big slide with everything the teacher can do on it (06 §3, §8.2): the picked element, in-place text editing,
 * the Text and Sticky note tools and, above them, the layers the screen adds (circle to edit). The wrapper is the
 * keyboard target: arrows nudge the picked element, Delete removes it, Enter edits it, PageUp/PageDown change slide,
 * Esc steps back. Tab walks the elements and leaves after the last one.
 */
export function StagePane({
  slide,
  slideNumber,
  styleProfile,
  tool,
  onToolChange,
  readOnly,
  generating,
  editing,
  notes,
  slideNotes,
  onStepSlide,
  onAddBlank,
  layers,
  resolveAsset,
  preview,
  onFillSpot,
  stageRef
}: StagePaneProps) {
  const [noteFocus, setNoteFocus] = useState<string | null>(null)

  const place = (kind: 'text' | 'note', at: { x: number; y: number }): void => {
    if (readOnly || !slide) return
    if (kind === 'text') editing.startDraft(at)
    else {
      setNoteFocus(notes.add(slide.id, at))
      onToolChange('select')
    }
  }

  const walk = (event: KeyboardEvent, direction: 1 | -1): boolean => {
    if (!slide || !editing.selectedId) return false
    const list = selectableElements(slide)
    const next = list[list.findIndex((el) => el.id === editing.selectedId) + direction]
    if (!next) {
      editing.select(null)
      return false
    }
    event.preventDefault()
    editing.select(next.id)
    return true
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isTextEntry(event.target) || event.ctrlKey || event.metaKey || event.altKey) return
    const { key } = event
    if (key.startsWith('Arrow') && editing.nudge(key, event.shiftKey)) event.preventDefault()
    else if ((key === 'Delete' || key === 'Backspace') && editing.removeSelected())
      event.preventDefault()
    else if (key === 'PageUp' || key === 'PageDown') {
      event.preventDefault()
      onStepSlide(key === 'PageUp' ? -1 : 1)
    } else if (key === 'Enter' && slide) {
      const picked = editing.selected
      if (picked && isEditableText(picked)) editing.startEdit(picked.id)
      else if (!picked) editing.select(selectableElements(slide)[0]?.id ?? null)
      event.preventDefault()
    } else if (key === 'Tab') walk(event, event.shiftKey ? -1 : 1)
    else if (key === 'Escape') {
      if (editing.selectedId) editing.select(null)
      else if (tool !== 'select' && tool !== 'circle') onToolChange('select')
    }
  }

  const empty = (
    <EmptyState
      icon={<Monitor strokeWidth={2} />}
      title="Your slides will appear here"
      actions={
        <Button shape="pill" disabled={generating || readOnly} onClick={onAddBlank}>
          Blank slide
        </Button>
      }
    >
      Ask the planning buddy to make them, or start with a blank slide.
    </EmptyState>
  )

  return (
    <div
      ref={stageRef}
      className="stage-pane"
      role="group"
      aria-label="Slide editing area"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <SlideStage
        slide={slide}
        styleProfile={styleProfile}
        label={slide ? slideLabel(slide, slideNumber) : undefined}
        showFitBadges
        resolveAsset={resolveAsset}
        spots="editor"
        onFillSpot={readOnly ? undefined : onFillSpot}
        empty={empty}
        cursor={
          tool === 'circle' || tool === 'draw' ? 'crosshair' : tool === 'text' ? 'text' : 'default'
        }
      >
        {(box) =>
          slide ? (
            <>
              <ElementLayer
                slide={slide}
                scale={box.scale}
                tool={tool}
                readOnly={readOnly}
                selectedId={editing.selectedId}
                editingId={editing.editingId}
                draft={editing.draft}
                onSelect={editing.select}
                onStartEdit={editing.startEdit}
                onCommitEdit={editing.commitEdit}
                onCommitDraft={editing.commitDraft}
                onMove={editing.move}
                onPlace={place}
                onFillSpot={readOnly ? undefined : onFillSpot}
              />
              {preview && <StagePreviewLayer preview={preview} />}
              <StickyNoteLayer
                notes={slideNotes}
                box={box}
                focusId={noteFocus}
                onEdit={notes.edit}
                onCommit={notes.commit}
                onRemove={notes.remove}
              />
              {layers?.(box)}
            </>
          ) : null
        }
      </SlideStage>
    </div>
  )
}
