import { titleText } from '@shared/deck/text'
import type { Slide } from '@shared/deck/types'

/** Accessible name of a slide: "Slide 3: What do plants need?" (just "Slide 3" when it has no title). */
export function slideLabel(slide: Slide, number: number): string {
  const title = titleText(slide)
  return title ? `Slide ${number}: ${title}` : `Slide ${number}`
}
