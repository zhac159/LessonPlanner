import { isPictureSpot } from '@shared/assets/spots'
import { findComponent } from '@shared/deck/textStyle'
import { resolveColor, resolveFont } from '@shared/deck/tokens'
import type { ColorValue, ImageElement } from '@shared/deck/types'
import { useSlideContext } from '../context'
import { slideFonts } from '../bundledFonts'
import { SpotView } from './SpotView'

const PLACEHOLDER_KEY = 'image.placeholder'
/** Same as the export: the `caption` role is 14 pt. */
const CAPTION_PT = 14

/**
 * A lesson picture (`assetId` through `resolveAsset`); a picture spot (no picture yet: editor chrome only, see
 * SpotView); or, for a picture that cannot be shown, a tinted box with its caption. Spot text never prints on a slide.
 */
export function ImageView({ element }: { element: ImageElement }) {
  const { style, resolveAsset } = useSlideContext()
  const spot: boolean = isPictureSpot(element) // a plain boolean, so the guard does not narrow `element` away
  if (spot) return <SpotView element={element} />
  const component = findComponent(style, element.styleRef ?? PLACEHOLDER_KEY, PLACEHOLDER_KEY)
  const radius = element.radius ?? component?.radius ?? 0
  const src = element.assetId ? resolveAsset?.(element.assetId) : null

  if (src) {
    return (
      <img
        className="slide-image"
        src={src}
        alt={element.alt}
        draggable={false}
        style={{ objectFit: element.fit, borderRadius: radius }}
      />
    )
  }
  const font = resolveFont(component?.font ?? 'body', style)
  return (
    <div
      className="slide-image slide-image--placeholder"
      role="img"
      aria-label={element.alt}
      style={{
        background: resolveColor((component?.fill ?? 'token:placeholder') as ColorValue, style),
        color: resolveColor((component?.color ?? 'token:muted') as ColorValue, style),
        borderRadius: radius,
        fontFamily: slideFonts.fontFamilyCss(font),
        fontSize: (component?.sizePt ?? CAPTION_PT) * 2
      }}
    >
      <span>{element.alt || element.placeholder?.description}</span>
    </div>
  )
}
