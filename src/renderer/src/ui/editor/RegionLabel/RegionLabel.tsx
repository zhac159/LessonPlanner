import { X } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { NumberDisc } from '../../atoms/NumberDisc/NumberDisc'
import { ProgressDots } from '../../atoms/ProgressDots/ProgressDots'
import './RegionLabel.css'

export interface RegionLabelProps {
  /** The region number: 1, 2, 3 per draft message. */
  n: number
  /** "Circled" while drafting; a summary of 4 words or fewer after sending. */
  text?: string
  /** The buddy is working on it: ProgressDots follow the text. */
  busy?: boolean
  /** Its chip is hovered or focused: the label lifts. */
  linked?: boolean
  /** Shows a remove button (revealed on hover or focus). Without it the label is decorative. */
  onRemove?: () => void
  className?: string
}

/**
 * The pill pinned to a circled region (design-system: RegionLabel): an orange number disc and a
 * short caption. Position it with a wrapper; the RegionOverlay does so for you.
 */
export function RegionLabel({
  n,
  text = 'Circled',
  busy = false,
  linked = false,
  onRemove,
  className
}: RegionLabelProps) {
  return (
    <span
      className={cx('region-label', className)}
      data-linked={linked || undefined}
      aria-hidden={onRemove ? undefined : true}
    >
      <NumberDisc size={22} tone="orange" className="region-label__n">
        {n}
      </NumberDisc>
      <span className="region-label__text">{text}</span>
      {busy && <ProgressDots size="sm" />}
      {onRemove && (
        <button
          type="button"
          className="region-label__remove"
          aria-label={`Remove region ${n}`}
          onClick={onRemove}
        >
          <X size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
