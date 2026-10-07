/**
 * The synthesised test slide must be about HER (agents/ASSETS.md §5.7, defect 6). The prompt asks for her subject and her
 * slide kinds; this is the code check behind it: literal dates are removed, a slide that is about something her decks never
 * mention (the old hard-coded "photosynthesis for Year 8") is thrown away, and a kind she does not use is replaced by one she does.
 * `null` means "draw the neutral provisional template instead" (04-create-style.md §8), which is always safe.
 */
import type { FileAnalysis } from '@shared/ai/types'
import type { Element, Slide, SlideKind } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { stripDates } from './dates'

/** Words that only ever came from the old fixed prompt. */
const FOREIGN = [/photosynthes/i, /chlorophyll/i, /\byear 8\b/i]

const textOf = (element: Element): string[] => {
  if (element.type === 'text' || element.type === 'callout')
    return [
      ...(element.type === 'callout' ? [element.label ?? ''] : []),
      ...element.paragraphs.flatMap((p) => p.runs.map((r) => r.text))
    ]
  if (element.type === 'chips') return element.items
  return []
}

export const slideText = (slide: Slide): string => slide.elements.flatMap(textOf).join(' ')

/** True when the slide talks about something none of her analyses (or her style's name) mention. */
export function isForeign(
  slide: Slide,
  analyses: readonly FileAnalysis[],
  styleName: string
): boolean {
  const text = slideText(slide)
  const known = `${styleName} ${JSON.stringify(analyses)}`
  return FOREIGN.some((word) => word.test(text) && !word.test(known))
}

function withoutDates(element: Element): Element | null {
  const strip = (text: string): string => stripDates(text)
  if (element.type === 'text' || element.type === 'callout') {
    const before = element.paragraphs.flatMap((p) => p.runs.map((r) => r.text)).join('')
    const paragraphs = element.paragraphs.map((p) => ({
      ...p,
      runs: p.runs.map((r) => ({ ...r, text: strip(r.text) }))
    }))
    const after = paragraphs.flatMap((p) => p.runs.map((r) => r.text)).join('')
    if (before.trim() !== '' && after.trim() === '') return null
    return { ...element, paragraphs }
  }
  if (element.type === 'chips')
    return { ...element, items: element.items.map(strip).filter(Boolean) }
  return element
}

/** The kind she uses most among content-like kinds, for when the model picked a kind she never uses. */
function usualKind(profile: StyleProfile): SlideKind | undefined {
  const kinds = profile.slideTypes.map((t) => t.kind)
  return (
    kinds.find((k) => k === 'key-words') ??
    kinds.find((k) => k === 'content') ??
    kinds.find((k) => k !== 'title')
  )
}

/** The slide to keep, or null (use the neutral template). */
export function checkTestSlide(
  slide: Slide,
  profile: StyleProfile,
  analyses: readonly FileAnalysis[]
): Slide | null {
  if (isForeign(slide, analyses, profile.name)) return null
  const elements = slide.elements.flatMap((el) => {
    const kept = withoutDates(el)
    return kept ? [kept] : []
  })
  const kinds = profile.slideTypes.map((t) => t.kind)
  const kind =
    kinds.length === 0 || kinds.includes(slide.kind)
      ? slide.kind
      : (usualKind(profile) ?? slide.kind)
  const layouts = profile.layouts.map((l) => l.id)
  const layoutId = slide.layoutId && layouts.includes(slide.layoutId) ? slide.layoutId : undefined
  const { layoutId: _drop, ...rest } = slide
  return { ...rest, kind, elements, ...(layoutId ? { layoutId } : {}) }
}
