import { Image as ImageIcon } from 'lucide-react'
import { spotInfo } from '@shared/assets/spots'
import type { ImageElement } from '@shared/deck/types'
import { useSlideContext } from '../context'

const SPOT_RADIUS = 12

/**
 * A picture spot (an image with a placeholder and no picture yet, agents/ASSETS.md §3.12). Editor chrome, not
 * slide content: it never shows in present mode, exports or the renderer. `thumbnail` mode is a faint dashed
 * box without text. Frame = the picture it will become (`radius` of the element, else 12).
 */
export function SpotView({ element }: { element: ImageElement }) {
  const { spots, onFillSpot } = useSlideContext()
  const radius = element.radius ?? SPOT_RADIUS
  if (spots === 'thumbnail') {
    return <div className="slide-spot slide-spot--thumb" style={{ borderRadius: radius }} />
  }
  const { description } = spotInfo(element)
  const label = `Fill picture spot: ${description}`
  const body = (
    <>
      <ImageIcon className="slide-spot__icon" aria-hidden="true" strokeWidth={1.75} />
      <span className="slide-spot__title">Picture spot</span>
      <span className="slide-spot__desc">{description}</span>
      <span className="slide-spot__pill">Fill this spot</span>
    </>
  )
  if (!onFillSpot) {
    return (
      <div
        className="slide-spot"
        role="img"
        aria-label={`Picture spot: ${description}`}
        style={{ borderRadius: radius }}
      >
        {body}
      </div>
    )
  }
  return (
    <button
      type="button"
      className="slide-spot slide-spot--button"
      aria-label={label}
      data-spot="true"
      style={{ borderRadius: radius }}
      onClick={() => onFillSpot(element.id)}
    >
      {body}
    </button>
  )
}
