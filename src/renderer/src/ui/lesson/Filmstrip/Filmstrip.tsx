import { Plus } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { cx } from '../../atoms/cx'
import type { Point } from '../../overlays/ContextMenu/position'
import { PictureSpotBadge } from '../../assets/PictureSpotBadge/PictureSpotBadge'
import type { SlideViewProps } from '../../slide'
import { SlideThumb } from '../SlideThumb/SlideThumb'
import { dropTarget, nudgeTarget, type AfterId } from './reorder'
import './Filmstrip.css'

/** Placeholders shown while the lesson has no slides and nothing is being built. */
const EMPTY_PLACEHOLDERS = 4

export interface FilmstripProps {
  slides: ReadonlyArray<Slide>
  /** The deck's StyleProfile (`null` = plain default style). */
  styleProfile: StyleProfile | null
  /** The slide on the stage. */
  selectedId: string | null
  /** horizontal = a row under the stage, vertical = a column. */
  layout?: 'horizontal' | 'vertical'
  /** A slide was chosen (click, Enter or Space). */
  onSelect: (slideId: string) => void
  /** Reorder: put `slideId` after `afterSlideId`, or first when `null`. Without it nothing can be moved. */
  onMove?: (slideId: string, afterSlideId: AfterId) => void
  /** The Delete key was pressed on a slide. */
  onDelete?: (slideId: string) => void
  /** Shows the "Add slide" button. */
  onAdd?: () => void
  /** Context menu requested on a slide (right-click, menu key, Shift+F10). */
  onSlideMenu?: (slideId: string, anchor: Point) => void
  /** Slides still to arrive while generating: shown as pulsing placeholders after the real ones. */
  pendingCount?: number
  /** New slides fade in (generation is streaming them). */
  reveal?: boolean
  resolveAsset?: SlideViewProps['resolveAsset']
  /** Empty picture spots per slide id: a faint box in the thumbnail and a dashed count badge by the number. */
  spotCounts?: ReadonlyMap<string, number>
  /** The badge was clicked: opens the first spot of that slide. */
  onSpotBadge?: (slideId: string) => void
  className?: string
}

type DropSide = 'before' | 'after'

const NUDGE_KEYS: Record<string, -1 | 1> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1
}

const thumbButtons = (nav: HTMLElement | null): HTMLElement[] =>
  nav ? Array.from(nav.querySelectorAll<HTMLElement>('button[data-slide-id]')) : []

/**
 * The slides of a lesson as thumbnails. One tab stop (roving tabindex): arrows move focus, Home and End
 * jump, Enter or Space opens the slide, Alt+arrow moves it, Delete asks to remove it. Thumbnails can also
 * be dragged to reorder. While generating, pulsing placeholders stand in for slides still to come.
 */
export function Filmstrip({
  slides,
  styleProfile,
  selectedId,
  layout = 'horizontal',
  onSelect,
  onMove,
  onDelete,
  onAdd,
  onSlideMenu,
  pendingCount = 0,
  reveal = false,
  resolveAsset,
  spotCounts,
  onSpotBadge,
  className
}: FilmstripProps) {
  const nav = useRef<HTMLElement>(null)
  const refocus = useRef<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; side: DropSide } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const ids = slides.map((slide) => slide.id)
  const tabStop = [focusId, selectedId].find((id) => id && ids.includes(id)) ?? ids[0] ?? null

  // Keep the chosen slide visible, and the moved slide focused after a keyboard reorder.
  useEffect(() => {
    const selected = thumbButtons(nav.current).find((el) => el.dataset.slideId === selectedId)
    selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [selectedId])
  useEffect(() => {
    if (!refocus.current) return
    thumbButtons(nav.current)
      .find((el) => el.dataset.slideId === refocus.current)
      ?.focus()
    refocus.current = null
  }, [slides])

  const focusAt = (index: number): void => thumbButtons(nav.current)[index]?.focus()

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('button[data-slide-id]')?.dataset
      .slideId
    if (!id) return
    const index = ids.indexOf(id)
    const step = NUDGE_KEYS[event.key]
    if (event.altKey && step) {
      event.preventDefault()
      const after = onMove ? nudgeTarget(ids, id, step) : undefined
      if (after === undefined) return
      refocus.current = id
      setAnnouncement(`Slide moved to position ${index + step + 1} of ${ids.length}`)
      onMove?.(id, after)
    } else if (step && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      focusAt(Math.min(Math.max(index + step, 0), ids.length - 1))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      focusAt(event.key === 'Home' ? 0 : ids.length - 1)
    } else if (event.key === 'Delete' && onDelete) {
      event.preventDefault()
      onDelete(id)
    }
  }

  const sideOf = (event: DragEvent<HTMLElement>): DropSide => {
    const rect = event.currentTarget.getBoundingClientRect()
    const vertical = layout === 'vertical'
    const middle = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2
    return (vertical ? event.clientY : event.clientX) < middle ? 'before' : 'after'
  }
  const endDrag = (): void => {
    setDragId(null)
    setOver(null)
  }
  const dragHandlers = (id: string) =>
    onMove
      ? {
          draggable: true,
          onDragStart: (event: DragEvent<HTMLElement>) => {
            event.dataTransfer?.setData('text/plain', id)
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
            setDragId(id)
          },
          onDragOver: (event: DragEvent<HTMLElement>) => {
            if (!dragId) return
            event.preventDefault()
            const side = sideOf(event)
            if (over?.id !== id || over.side !== side) setOver({ id, side })
          },
          onDrop: (event: DragEvent<HTMLElement>) => {
            if (!dragId) return
            event.preventDefault()
            const after = dropTarget(ids, dragId, id, sideOf(event))
            endDrag()
            if (after !== undefined) onMove(dragId, after)
          },
          onDragEnd: endDrag
        }
      : {}

  const empty = slides.length === 0 && pendingCount === 0
  const placeholders = empty ? EMPTY_PLACEHOLDERS : pendingCount
  const status = announcement || (pendingCount > 0 ? 'Building your slides' : '')

  return (
    <nav
      ref={nav}
      aria-label="Slides"
      className={cx('filmstrip', className)}
      data-layout={layout}
      onKeyDown={onKeyDown}
    >
      <ul className="filmstrip__list">
        {slides.map((slide, index) => (
          <li
            key={slide.id}
            className="filmstrip__item"
            data-drop={over?.id === slide.id && dragId !== slide.id ? over.side : undefined}
            style={{ ['--reveal-index' as string]: index }}
            {...dragHandlers(slide.id)}
          >
            <SlideThumb
              slide={slide}
              styleProfile={styleProfile}
              number={index + 1}
              selected={slide.id === selectedId}
              dragging={slide.id === dragId}
              reveal={reveal}
              tabIndex={slide.id === tabStop ? 0 : -1}
              onFocus={() => setFocusId(slide.id)}
              onSelect={() => onSelect(slide.id)}
              onMenu={onSlideMenu && ((anchor) => onSlideMenu(slide.id, anchor))}
              resolveAsset={resolveAsset}
              spots={spotCounts ? 'thumbnail' : undefined}
            />
            {onSpotBadge && (
              <PictureSpotBadge
                className="filmstrip__spots"
                slideNumber={index + 1}
                count={spotCounts?.get(slide.id) ?? 0}
                onClick={() => onSpotBadge(slide.id)}
              />
            )}
          </li>
        ))}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`pending-${i}`} className="filmstrip__item" aria-hidden="true">
            <SlideThumb styleProfile={null} variant={empty ? 'placeholder' : 'generating'} />
          </li>
        ))}
        {onAdd && (
          <li className="filmstrip__item">
            <button type="button" className="filmstrip__add" aria-label="Add slide" onClick={onAdd}>
              <Plus size={22} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
      <span className="sr-only" role="status">
        {status}
      </span>
    </nav>
  )
}
