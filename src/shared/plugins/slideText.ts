/** The slides as plain text for a plugin's prompt: position, id, kind, title and each element's words. Pure. */
import { elementText, titleText } from '../deck/text'
import type { Slide } from '../deck/types'

const MAX_ELEMENT_CHARS = 400

const clip = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > MAX_ELEMENT_CHARS ? `${flat.slice(0, MAX_ELEMENT_CHARS - 1)}…` : flat
}

/**
 * One block per slide:
 *   Slide 3 (id s3, kind: objectives) "What plants need"
 *   - Describe where photosynthesis happens …
 * `numbers` gives each slide's position in the whole deck (the teacher says "slide 3").
 */
export function describeSlides(
  slides: readonly Slide[],
  numbers: (slide: Slide) => number = (slide) => slides.indexOf(slide) + 1
): string {
  return slides
    .map((slide) => {
      const title = titleText(slide)
      const head = `Slide ${numbers(slide)} (id ${slide.id}, kind: ${slide.kind})${title ? ` "${title}"` : ''}`
      const lines = slide.elements
        .filter((e) => !(e.type === 'text' && e.role === 'title'))
        .map((e) => clip(elementText(e)))
        .filter(Boolean)
        .map((line) => `- ${line}`)
      return [head, ...lines].join('\n')
    })
    .join('\n\n')
}
