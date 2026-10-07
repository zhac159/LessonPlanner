import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '@shared/deck/types'
import { cx } from '../../atoms/cx'
import { RegionLabel } from '../RegionLabel/RegionLabel'
import { boundsOf, dimOutsideData, labelPlacement, pathData } from './geometry'
import { initialPen, penKey, type PenState } from './keyboardPen'
import { usePointerLoop } from './usePointerLoop'
import './RegionOverlay.css'

/** A circled region as the overlay draws it. */
export interface OverlayRegion {
  id: string
  /** 1, 2, 3 per draft message; numbers are never reused. */
  n: number
  /** The closed loop, in slide units. */
  path: StrokePath
  /** Label text; "Circled" while drafting. */
  caption?: string
  /** The buddy is working on it (ProgressDots after the caption). */
  busy?: boolean
  /** Its chip is hovered or focused: the stroke thickens. */
  linked?: boolean
}

export interface RegionOverlayProps {
  /** Drawing is on (the Circle tool). Off, the overlay only shows regions and ignores the pointer. */
  active: boolean
  regions: OverlayRegion[]
  /** The region to emphasise: everything outside it is dimmed. */
  activeRegionId?: string | null
  /** Displayed pixels per slide unit. Measured from the overlay's box when omitted. */
  scale?: number
  /** A loop was finished, by pointer or keyboard: its raw points in slide units (not simplified). */
  onComplete: (points: StrokePath) => void
  /** A click or tap without dragging, in slide units (selects the region under it). */
  onPoint?: (point: [number, number]) => void
  /** A stroke in progress was abandoned. */
  onCancel?: () => void
  /** Makes each label removable. */
  onRemoveRegion?: (id: string) => void
  className?: string
}

const KEYBOARD_HELP =
  'Circle an area. Arrow keys move the pen, Enter puts it down and picks it up to finish the loop, Escape cancels.'

/**
 * The annotation layer over the slide stage (design-system: RegionOverlay): an SVG in slide units
 * (1920 x 1080) that draws the numbered regions and, while the Circle tool is on, lets the
 * teacher draw a freehand loop with the pointer or, from the keyboard, with arrows and Enter.
 * It reports the raw points; simplifying and closing the loop is the owner's job.
 * Place it inside a relatively positioned box that has the slide's aspect ratio.
 */
export function RegionOverlay({
  active,
  regions,
  activeRegionId = null,
  scale,
  onComplete,
  onPoint,
  onCancel,
  onRemoveRegion,
  className
}: RegionOverlayProps) {
  const root = useRef<HTMLDivElement>(null)
  const pointer = usePointerLoop({ active, boxRef: root, scale, onComplete, onPoint, onCancel })
  const [pen, setPen] = useState<PenState>(initialPen)
  const [focused, setFocused] = useState(false)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!active || event.target !== event.currentTarget) return
    const outcome = penKey(pen, event.key, event.shiftKey)
    if (!outcome.handled) return
    event.preventDefault()
    event.stopPropagation()
    setPen(outcome.state)
    if (outcome.complete) onComplete(outcome.complete)
    if (outcome.cancelled) onCancel?.()
  }

  const dimmed = regions.find((region) => region.id === activeRegionId)
  const live = pointer.stroke ?? pen.stroke

  return (
    <div
      ref={root}
      className={cx('region-overlay', className)}
      data-active={active || undefined}
      data-drawing={live ? true : undefined}
      tabIndex={active ? 0 : undefined}
      role={active ? 'application' : undefined}
      aria-label={active ? 'Circle to edit' : undefined}
      aria-description={active ? KEYBOARD_HELP : undefined}
      onKeyDown={onKeyDown}
      onFocus={(event) => setFocused(event.target === event.currentTarget)}
      onBlur={() => {
        setFocused(false)
        if (pen.stroke) {
          setPen({ ...pen, stroke: null })
          onCancel?.()
        }
      }}
      {...pointer.handlers}
    >
      <svg
        className="region-overlay__svg"
        viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {dimmed && <path className="region-overlay__dim" d={dimOutsideData(dimmed.path)} />}
        {regions.map((region) => (
          <path
            key={region.id}
            className="region-overlay__stroke"
            data-linked={region.linked || undefined}
            d={pathData(region.path, true)}
          />
        ))}
        {live && <path className="region-overlay__stroke" d={pathData(live)} />}
        {active && focused && (
          <circle className="region-overlay__cursor" cx={pen.cursor[0]} cy={pen.cursor[1]} r={14} />
        )}
      </svg>
      {regions.map((region) => {
        const bounds = boundsOf(region.path)
        if (!bounds) return null
        const { left, top } = labelPlacement(bounds)
        const style = { '--label-left': `${left}%`, '--label-top': `${top}%` } as CSSProperties
        return (
          <div key={region.id} className="region-overlay__label" style={style}>
            <RegionLabel
              n={region.n}
              text={region.caption}
              busy={region.busy}
              linked={region.linked}
              onRemove={onRemoveRegion ? () => onRemoveRegion(region.id) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}
