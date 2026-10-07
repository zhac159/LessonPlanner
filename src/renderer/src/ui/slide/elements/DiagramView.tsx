import { useMemo } from 'react'
import { sanitiseSvg, scopeSvgIds } from '@shared/deck/svg'
import type { DiagramElement } from '@shared/deck/types'
import { useSlideContext } from '../context'

/**
 * Claude-drawn diagram as inline SVG. The SVG is sanitised again here (defence in depth: it was also
 * sanitised when it entered the deck) and its ids are scoped, so two diagrams on a page never clash.
 */
export function DiagramView({ element }: { element: DiagramElement }) {
  const { instanceId } = useSlideContext()
  const html = useMemo(() => {
    const result = sanitiseSvg(element.svg)
    return result.ok ? scopeSvgIds(result.svg, `${instanceId}-${element.id}-`) : null
  }, [element.svg, element.id, instanceId])

  if (html === null) {
    return (
      <div className="slide-diagram slide-diagram--broken" role="img" aria-label={element.alt}>
        Diagram unavailable
      </div>
    )
  }
  return (
    <div
      className="slide-diagram"
      role="img"
      aria-label={element.alt}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
