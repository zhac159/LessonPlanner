import { Image as ImageIcon } from 'lucide-react'
import { cx } from '../../atoms/cx'
import './SpotMark.css'

export interface SpotMarkProps {
  /** What Claude thinks belongs here: "A leaf in sunlight, close up". */
  description: string
  /** Fills the spot. Without it the mark is only a picture of a spot (a stage that cannot be clicked). */
  onFill?: () => void
  /** full = the stage overlay with text and a button; faint = the dashed box in thumbnails, no text. */
  variant?: 'full' | 'faint'
  /** The spot is the selected element. */
  selected?: boolean
  fillLabel?: string
  className?: string
}

/** The dashed "Picture spot" box that fills the frame of the picture it stands for (editor only; never exported). */
export function SpotMark({
  description,
  onFill,
  variant = 'full',
  selected = false,
  fillLabel = 'Fill this spot',
  className
}: SpotMarkProps) {
  if (variant === 'faint') {
    return <span className={cx('as-spot', className)} data-variant="faint" aria-hidden="true" />
  }
  const body = (
    <>
      <ImageIcon className="as-spot__icon" size={32} strokeWidth={1.8} aria-hidden="true" />
      <span className="as-spot__title">Picture spot</span>
      <span className="as-spot__text">{description}</span>
      <span className="as-spot__pill">{fillLabel}</span>
    </>
  )
  const shared = {
    className: cx('as-spot', className),
    'data-variant': 'full',
    'data-selected': selected || undefined
  }
  return onFill ? (
    <button
      type="button"
      {...shared}
      aria-label={`Fill picture spot: ${description}`}
      onClick={onFill}
    >
      {body}
    </button>
  ) : (
    <div {...shared}>{body}</div>
  )
}
