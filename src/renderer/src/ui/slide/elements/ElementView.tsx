import { memo, type CSSProperties } from 'react'
import type { Element } from '@shared/deck/types'
import { cx } from '../../atoms/cx'
import { CalloutView } from './CalloutView'
import { ChipsView } from './ChipsView'
import { DiagramView } from './DiagramView'
import { ImageView } from './ImageView'
import { ShapeView } from './ShapeView'
import { TableView } from './TableView'
import { TextView } from './TextView'

function Body({ element }: { element: Element }) {
  switch (element.type) {
    case 'text':
      return <TextView element={element} />
    case 'chips':
      return <ChipsView element={element} />
    case 'callout':
      return <CalloutView element={element} />
    case 'image':
      return <ImageView element={element} />
    case 'diagram':
      return <DiagramView element={element} />
    case 'shape':
      return <ShapeView element={element} />
    case 'table':
      return <TableView element={element} />
  }
}

/**
 * Absolutely positioned frame for one element (box, rotation, z). Memoised: with structural sharing
 * (immer) only elements that actually changed re-render.
 */
export const ElementView = memo(function ElementView({ element }: { element: Element }) {
  const frame: CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.z
  }
  return (
    <div
      className={cx('slide-el', element.locked && 'is-locked')}
      style={frame}
      data-element-id={element.id}
      data-element-type={element.type}
      data-locked={element.locked ? 'true' : undefined}
    >
      <Body element={element} />
    </div>
  )
})
