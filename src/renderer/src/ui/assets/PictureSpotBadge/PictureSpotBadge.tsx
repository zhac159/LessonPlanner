import { Image as ImageIcon } from 'lucide-react'
import { cx } from '../../atoms/cx'
import './PictureSpotBadge.css'

export interface PictureSpotBadgeProps {
  slideNumber: number
  /** Empty spots on that slide; 0 draws nothing. */
  count: number
  /** Opens the first spot of the slide. */
  onClick: () => void
  className?: string
}

/** The dashed mini badge next to a slide's number in the filmstrip: an image icon and the count. */
export function PictureSpotBadge({
  slideNumber,
  count,
  onClick,
  className
}: PictureSpotBadgeProps) {
  if (count <= 0) return null
  return (
    <button
      type="button"
      className={cx('as-spotbadge', className)}
      aria-label={`Slide ${slideNumber} has ${count} picture ${count === 1 ? 'spot' : 'spots'}`}
      onClick={onClick}
    >
      <ImageIcon size={12} strokeWidth={2} aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
    </button>
  )
}
