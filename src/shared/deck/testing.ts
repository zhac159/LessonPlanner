/** Test-only builders for deck data (imported by *.test.ts(x) files, never by app code). */
import deckJson from '../../../design/fixtures/deck.photosynthesis.json'
import styleJson from '../../../design/fixtures/style-profile.science-ks3.json'
import type { StyleProfile } from '../style/types'
import type { ChangeSet, Deck, DeckOp, Slide, TextElement } from './types'

/** A fresh copy of design/fixtures/deck.photosynthesis.json (3 slides). */
export const fixtureDeck = (): Deck => structuredClone(deckJson) as unknown as Deck

/** A fresh copy of design/fixtures/style-profile.science-ks3.json (Lexend, teal on navy). */
export const fixtureStyle = (): StyleProfile =>
  structuredClone(styleJson) as unknown as StyleProfile

export const FIXED_NOW = new Date('2026-10-06T12:00:00.000Z')
export const fixedClock = (): Date => FIXED_NOW

/** A text element with one run; override anything. */
export function makeText(id: string, text: string, over: Partial<TextElement> = {}): TextElement {
  return {
    id,
    type: 'text',
    role: 'body',
    x: 100,
    y: 100,
    w: 800,
    h: 200,
    paragraphs: [{ runs: [{ text }] }],
    ...over
  }
}

export function makeSlide(id: string, over: Partial<Slide> = {}): Slide {
  return { id, kind: 'content', elements: [], ...over }
}

let counter = 0
/** A ChangeSet wrapping `ops`. */
export function makeChangeSet(ops: DeckOp[], over: Partial<ChangeSet> = {}): ChangeSet {
  counter += 1
  return {
    id: `chg_test_${counter}`,
    by: 'ai',
    summary: `Test change ${counter}`,
    ops,
    at: FIXED_NOW.toISOString(),
    ...over
  }
}
