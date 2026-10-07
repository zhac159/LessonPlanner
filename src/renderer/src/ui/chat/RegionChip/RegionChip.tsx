import { X } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { NumberDisc } from '../../atoms/NumberDisc/NumberDisc'
import './RegionChip.css'

export interface RegionChipProps {
  /** The region's number on the slide. Leave out for a drawing ("marked up"): there is no disc. */
  n?: number
  /** The slide it belongs to, 1-based. */
  slideNumber: number
  /** What was done: "circled" (default) or "marked up". */
  caption?: string
  /** What is under it, for the accessible name: "photo of a leaf". */
  description?: string
  /** Its slide was deleted: dashed, muted, reads "Slide 3 · removed", no longer clickable. */
  removed?: boolean
  /** Jump to the slide and pulse the region. Without it the chip is plain text. */
  onClick?: () => void
  /** Adds a trailing × (a chip staged in the Composer). */
  onRemove?: () => void
  /** Accessible name of the ×. Defaults to "Remove region {n}" (or "Remove drawing"). */
  removeLabel?: string
  /** Fired with true on hover or focus and false on leave or blur, to outline the region. */
  onHighlight?: (on: boolean) => void
  className?: string
}

/** A numbered pill that points at a circled region of a slide (Composer and sent messages). */
export function RegionChip({
  n,
  slideNumber,
  caption = 'circled',
  description,
  removed = false,
  onClick,
  onRemove,
  removeLabel,
  onHighlight,
  className
}: RegionChipProps) {
  const text = `Slide ${slideNumber} · ${removed ? 'removed' : caption}`
  const interactive = Boolean(onClick) && !removed
  const base = n === undefined ? text : `Region ${n} on slide ${slideNumber}`
  const name = description && !removed ? `${base}: ${description}` : base
  const content = (
    <>
      {n !== undefined && (
        <NumberDisc size={20} tone="orange">
          {n}
        </NumberDisc>
      )}
      <span>{text}</span>
    </>
  )
  return (
    <span
      className={cx('ui-region', className)}
      data-removed={removed || undefined}
      onMouseEnter={() => onHighlight?.(true)}
      onMouseLeave={() => onHighlight?.(false)}
      onFocus={() => onHighlight?.(true)}
      onBlur={() => onHighlight?.(false)}
    >
      {interactive ? (
        <button type="button" className="ui-region__main" aria-label={name} onClick={onClick}>
          {content}
        </button>
      ) : (
        <span className="ui-region__main" title={removed ? undefined : name}>
          {content}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className="ui-region__remove"
          aria-label={removeLabel ?? (n === undefined ? 'Remove drawing' : `Remove region ${n}`)}
          onClick={onRemove}
        >
          <X size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
