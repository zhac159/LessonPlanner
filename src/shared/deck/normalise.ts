/**
 * Normalisation that runs after every ChangeSet (design/deck-model.md §3.3): clamp boxes inside the slide,
 * give id-less elements ids, drop empty runs, keep ids unique. The `*InPlace` functions mutate (they are
 * meant to run inside an immer recipe); `normaliseDeck` is the pure wrapper.
 */
import { produce } from 'immer'
import { newId } from '../ids'
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type Deck,
  type Element,
  type Paragraph,
  type Slide
} from './types'

const MIN_SIZE = 1

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

/** Keeps the element's (unrotated) box inside the 1920x1080 slide, never smaller than 1 unit. */
export function clampBox(el: Pick<Element, 'x' | 'y' | 'w' | 'h'>): void {
  el.w = clamp(el.w, MIN_SIZE, SLIDE_WIDTH)
  el.h = clamp(el.h, MIN_SIZE, SLIDE_HEIGHT)
  el.x = clamp(el.x, 0, SLIDE_WIDTH - el.w)
  el.y = clamp(el.y, 0, SLIDE_HEIGHT - el.h)
}

/** Removes zero-length runs. Paragraphs stay (an empty paragraph is a blank line). */
function dropEmptyRuns(paragraphs: Paragraph[]): void {
  for (const p of paragraphs) {
    if (p.runs.some((r) => r.text === '')) p.runs = p.runs.filter((r) => r.text !== '')
  }
}

/** Scales `colWidths` to sum to the element width; drops them when the column count is wrong. */
function fixColumnWidths(table: Extract<Element, { type: 'table' }>): void {
  const widths = table.colWidths
  if (!widths) return
  const columns = Math.max(0, ...table.rows.map((r) => r.length))
  const sum = widths.reduce((a, b) => a + b, 0)
  if (widths.length !== columns || sum <= 0) {
    delete table.colWidths
  } else if (Math.abs(sum - table.w) > 1) {
    table.colWidths = widths.map((w) => (w * table.w) / sum)
  }
}

function normaliseElement(el: Element): void {
  clampBox(el)
  if (el.type === 'text' || el.type === 'callout') dropEmptyRuns(el.paragraphs)
  if (el.type === 'chips' && el.items.some((i) => i.trim() === '')) {
    el.items = el.items.filter((i) => i.trim() !== '')
  }
  if (el.type === 'table') fixColumnWidths(el)
}

/** Normalises one slide: ids unique per slide (first wins), boxes clamped, empty runs dropped. */
export function normaliseSlideInPlace(slide: Slide): void {
  const seen = new Set<string>()
  for (const el of slide.elements) {
    if (!el.id || seen.has(el.id)) el.id = newId('el')
    seen.add(el.id)
    normaliseElement(el)
  }
}

/** Normalises a whole deck: slide ids unique (first wins), then every slide. */
export function normaliseDeckInPlace(deck: Deck): void {
  const seen = new Set<string>()
  for (const slide of deck.slides) {
    if (!slide.id || seen.has(slide.id)) slide.id = newId('sld')
    seen.add(slide.id)
    normaliseSlideInPlace(slide)
  }
}

/** Pure version: returns the same deck object when nothing needed fixing. */
export const normaliseDeck = (deck: Deck): Deck => produce(deck, normaliseDeckInPlace)
