/**
 * The deck outline sent to Claude on every turn (design/ai-pipeline.md §3): ids, kinds, titles and element
 * handles, small enough to always include. Pure.
 */
import { elementText, titleText } from './text'
import type { Deck, SlideKind } from './types'

export interface OutlineElement {
  id: string
  type: string
  /** The `name` label ("photo", "objectives list"), when the element has one. */
  name?: string
  /** First ~60 characters of its text/alt, to help Claude pick the right element. */
  preview: string
  locked?: boolean
  /** Text overflowed even at the smallest size (reported by the editor's renderer). */
  doesntFit?: boolean
}

export interface OutlineSlide {
  /** 1-based position, matches what the teacher sees ("slide 3"). */
  number: number
  id: string
  kind: SlideKind
  title: string
  hasNotes: boolean
  elements: OutlineElement[]
}

export interface DeckOutline {
  deckId: string
  title: string
  slides: OutlineSlide[]
}

export interface OutlineOptions {
  /** Ids of elements the renderer reported as not fitting. */
  doesntFit?: ReadonlySet<string> | readonly string[]
}

const PREVIEW_LENGTH = 60

const preview = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat
}

/** Builds the outline. `doesntFit` ids are flagged so Claude can fix them on its next turn. */
export function deckOutline(deck: Deck, options: OutlineOptions = {}): DeckOutline {
  const flagged = new Set(options.doesntFit ?? [])
  return {
    deckId: deck.id,
    title: deck.title,
    slides: deck.slides.map((slide, i) => ({
      number: i + 1,
      id: slide.id,
      kind: slide.kind,
      title: titleText(slide),
      hasNotes: Boolean(slide.notes?.trim()),
      elements: slide.elements.map((el) => ({
        id: el.id,
        type: el.type,
        ...(el.name ? { name: el.name } : {}),
        preview: preview(elementText(el)),
        ...(el.locked ? { locked: true } : {}),
        ...(flagged.has(el.id) ? { doesntFit: true } : {})
      }))
    }))
  }
}

/** Compact prompt text: one line per slide, one indented line per element. */
export function outlineText(outline: DeckOutline): string {
  const lines = [`Deck "${outline.title}" (${outline.deckId})`]
  for (const s of outline.slides) {
    lines.push(
      `${s.number}. [${s.id}] ${s.kind}: ${s.title || '(no title)'}${s.hasNotes ? ' (notes)' : ''}`
    )
    for (const e of s.elements) {
      const flags = [e.locked ? 'locked' : '', e.doesntFit ? "doesn't fit" : ''].filter(Boolean)
      const label = e.name ? ` "${e.name}"` : ''
      lines.push(
        `   - ${e.id} ${e.type}${label}${flags.length ? ` (${flags.join(', ')})` : ''}: ${e.preview}`
      )
    }
  }
  return lines.join('\n')
}
