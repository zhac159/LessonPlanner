/** The text block that tells Claude which part of which slide was circled (design/ai-pipeline.md §6 step 4). */
import { elementText } from '../deck/text'
import type { Element, Slide } from '../deck/types'
import { polygonBoundingBox } from './geometry'
import { targetElements } from './overlap'
import type { Region } from './types'

const MAX_LABEL = 60

/** One line of text for an element's content, cut to a readable length. */
function label(element: Element): string {
  const text = element.type === 'shape' ? '' : elementText(element).replace(/\s+/g, ' ').trim()
  return text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1).trimEnd()}…` : text
}

/** `e3-photo (image "Photo: leaf in sunlight")`: the id Claude must use, what it is, and what it says. */
export function describeElement(element: Element): string {
  const kind = element.type === 'shape' ? `shape ${element.shape}` : element.type
  const text = label(element)
  return `${element.id} (${kind}${text ? ` "${text}"` : ''})`
}

/**
 * The region's text block, e.g. `Region 1 on slide 3 (id s3) targets elements: e3-photo (image "Photo: leaf
 * in sunlight"). Region bbox: x 1075, y 300, w 790, h 550.` The bbox is recomputed from the path (whole
 * units) so it can never disagree with the loop Claude sees in the picture.
 */
export function describeRegion(
  region: Pick<Region, 'n' | 'slideId' | 'path'>,
  slide: Slide,
  slideNumber: number
): string {
  const targets = targetElements(slide, region).map(describeElement)
  const { x, y, w, h } = polygonBoundingBox(region.path)
  const subject =
    targets.length > 0 ? `targets elements: ${targets.join(', ')}` : 'targets no element'
  return (
    `Region ${region.n} on slide ${slideNumber} (id ${region.slideId}) ${subject}. ` +
    `Region bbox: x ${Math.round(x)}, y ${Math.round(y)}, w ${Math.round(w)}, h ${Math.round(h)}.`
  )
}
