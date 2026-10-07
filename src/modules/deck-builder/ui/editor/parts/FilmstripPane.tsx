import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { Filmstrip, type AfterId } from '@ui/lesson'
import { ContextMenu, type MenuItem, type Point } from '@ui/overlays'
import type { SlideSelectionApi } from '../hooks/useSlideSelection'
import { useThumbMarks } from '../hooks/useThumbMarks'
import './FilmstripPane.css'

export interface FilmstripPaneProps {
  slides: ReadonlyArray<Slide>
  styleProfile: StyleProfile | null
  selection: SlideSelectionApi
  /** An AI job or generation is running: slides can be selected but not changed (06 §7). */
  readOnly: boolean
  /** Skeletons for slides still to come. */
  pending: number
  /** Streamed slides fade in. */
  reveal: boolean
  flashIds: readonly string[]
  highlightIds: readonly string[]
  /** Slides that have a circled region waiting. */
  regionSlideIds: readonly string[]
  onMove(slideId: string, after: AfterId): void
  /** Delete key or menu: every slide in `slideIds` goes in one step. */
  onDelete(slideIds: string[]): void
  onDuplicate(slideId: string): void
  /** Adds a blank slide after this one (first when null, for an empty lesson). */
  onAddAfter(slideId: string | null): void
  /** Enter on a thumbnail moves focus to the stage (06 §8.1). */
  onFocusStage(): void
  /** Pictures for the thumbnails (the library's copies, by asset id). */
  resolveAsset?: (assetId: string) => string | undefined
  /** Empty picture spots per slide id (A12): a faint box in the thumbnail and a dashed count badge. */
  spotCounts?: ReadonlyMap<string, number>
  /** The badge opens the first spot of that slide. */
  onSpotBadge?(slideId: string): void
}

interface Modifiers {
  shift: boolean
  ctrl: boolean
}

const STEPS = { ArrowLeft: 'prev', ArrowRight: 'next', Home: 'first', End: 'last' } as const

const thumbOf = (target: EventTarget | null): HTMLElement | null =>
  (target as HTMLElement | null)?.closest<HTMLElement>('button[data-slide-id]') ?? null

/**
 * The filmstrip with what the kit leaves to the screen (06 §8.1): Shift/Ctrl multi-selection, arrows that select,
 * Enter to the stage, the thumbnail menu, and the marks for flashes, highlights and region dots.
 */
export function FilmstripPane({
  slides,
  styleProfile,
  selection: api,
  readOnly,
  pending,
  reveal,
  flashIds,
  highlightIds,
  regionSlideIds,
  onMove,
  onDelete,
  onDuplicate,
  onAddAfter,
  onFocusStage,
  resolveAsset,
  spotCounts,
  onSpotBadge
}: FilmstripPaneProps) {
  const root = useRef<HTMLDivElement>(null)
  const modifiers = useRef<Modifiers>({ shift: false, ctrl: false })
  const [menu, setMenu] = useState<{ slideId: string; anchor: Point } | null>(null)
  const { selection } = api
  const ids = useMemo(() => slides.map((slide) => slide.id), [slides])

  const others = useMemo(
    () => selection.ids.filter((id) => id !== selection.current),
    [selection.ids, selection.current]
  )
  useThumbMarks(
    root,
    { multi: others, flash: flashIds, highlight: highlightIds, region: regionSlideIds },
    ids.join('|')
  )

  const focusThumb = (id: string | null): void => {
    if (!id) return
    root.current
      ?.querySelectorAll<HTMLElement>('button[data-slide-id]')
      .forEach((el) => el.dataset.slideId === id && el.focus())
  }

  const onClickCapture = (event: MouseEvent): void => {
    modifiers.current = { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey }
  }
  const onSelect = (id: string): void => {
    const { shift, ctrl } = modifiers.current
    modifiers.current = { shift: false, ctrl: false }
    if (shift) api.extend(id)
    else if (ctrl) api.toggle(id)
    else api.select(id)
  }

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    const thumb = thumbOf(event.target)
    if (!thumb) return
    const key = event.key as keyof typeof STEPS
    if (STEPS[key] && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      event.stopPropagation()
      api.step(STEPS[key], event.shiftKey && key !== 'Home' && key !== 'End')
      const from = thumb.dataset.slideId ?? null
      const index = from ? ids.indexOf(from) : -1
      const target = { prev: index - 1, next: index + 1, first: 0, last: ids.length - 1 }[
        STEPS[key]
      ]
      focusThumb(ids[Math.min(Math.max(target, 0), ids.length - 1)])
    } else if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (thumb.dataset.slideId) api.select(thumb.dataset.slideId)
      onFocusStage()
    } else if (event.key === 'Escape' && selection.ids.length > 1) {
      event.stopPropagation()
      api.collapse()
    }
  }

  const removing = (id: string): string[] =>
    selection.ids.includes(id) && selection.ids.length > 1 ? selection.ids : [id]

  const menuItems = (slideId: string): MenuItem[] => {
    const index = ids.indexOf(slideId)
    return [
      {
        id: 'duplicate',
        label: 'Duplicate slide',
        icon: <Copy size={16} />,
        onSelect: () => onDuplicate(slideId)
      },
      {
        id: 'delete',
        label: 'Delete slide',
        icon: <Trash2 size={16} />,
        danger: true,
        onSelect: () => onDelete(removing(slideId))
      },
      {
        id: 'left',
        label: 'Move left',
        disabled: index <= 0,
        onSelect: () => onMove(slideId, ids[index - 2] ?? null)
      },
      {
        id: 'right',
        label: 'Move right',
        disabled: index < 0 || index >= ids.length - 1,
        onSelect: () => onMove(slideId, ids[index + 1])
      },
      {
        id: 'add',
        label: 'Add slide after',
        icon: <Plus size={16} />,
        onSelect: () => onAddAfter(slideId)
      }
    ]
  }

  return (
    <div
      ref={root}
      className="editor-film"
      onClickCapture={onClickCapture}
      onKeyDownCapture={onKeyDownCapture}
    >
      <Filmstrip
        slides={slides}
        styleProfile={styleProfile}
        selectedId={selection.current}
        pendingCount={pending}
        reveal={reveal}
        resolveAsset={resolveAsset}
        spotCounts={spotCounts}
        onSpotBadge={readOnly ? undefined : onSpotBadge}
        onSelect={onSelect}
        onMove={readOnly ? undefined : onMove}
        onDelete={readOnly ? undefined : (id) => onDelete(removing(id))}
        onAdd={
          readOnly ? undefined : () => onAddAfter(selection.current ?? ids[ids.length - 1] ?? null)
        }
        onSlideMenu={readOnly ? undefined : (slideId, anchor) => setMenu({ slideId, anchor })}
      />
      <ContextMenu
        open={menu !== null}
        anchor={menu?.anchor ?? null}
        items={menu ? menuItems(menu.slideId) : []}
        label="Slide actions"
        onClose={() => setMenu(null)}
      />
    </div>
  )
}
