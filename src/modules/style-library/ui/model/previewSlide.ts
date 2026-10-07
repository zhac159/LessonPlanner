/**
 * What the "Test slide in this style" card draws: the provisional template (04 §8) until Claude's
 * synthesis has produced a test slide, and the StyleProfile that SlideView needs, built from the
 * display view the main process sends. Slides use the style's colours and fonts only.
 */
import type { StyleProfileView } from '@shared/contracts/style-library'
import type { Slide } from '@shared/deck/types'
import { createDraftProfile } from '@shared/style/draft'
import type { StyleProfile } from '@shared/style/types'

const EPOCH = '2000-01-01T00:00:00.000Z'

/** A fixed Key words slide drawn with the current tokens and components. No AI call. */
export function provisionalTestSlide(topic = 'Cells'): Slide {
  return {
    id: 'provisional-test-slide',
    kind: 'key-words',
    elements: [
      {
        id: 'band',
        type: 'shape',
        shape: 'rect',
        x: 0,
        y: 0,
        w: 27,
        h: 1080,
        locked: true,
        styleRef: 'decoration.leftBand',
        fill: { color: 'token:accent' }
      },
      {
        id: 'kicker',
        type: 'text',
        role: 'kicker',
        styleRef: 'kicker',
        x: 125,
        y: 86,
        w: 1700,
        h: 36,
        paragraphs: [{ runs: [{ text: `Lesson 1 · ${topic}` }] }]
      },
      {
        id: 'title',
        type: 'text',
        role: 'title',
        styleRef: 'title',
        x: 125,
        y: 140,
        w: 1700,
        h: 110,
        paragraphs: [{ runs: [{ text: 'Key ' }, { text: 'words', color: 'token:accent' }] }]
      },
      {
        id: 'chips',
        type: 'chips',
        styleRef: 'chip',
        x: 125,
        y: 290,
        w: 1700,
        h: 60,
        items: ['nucleus', 'cell membrane', 'cytoplasm']
      },
      {
        id: 'question',
        type: 'callout',
        variant: 'mini-whiteboard',
        styleRef: 'callout.mini-whiteboard',
        label: 'Mini-whiteboards:',
        x: 125,
        y: 860,
        w: 1700,
        h: 120,
        paragraphs: [{ runs: [{ text: 'Which part controls the cell?' }] }]
      }
    ]
  }
}

/** The StyleProfile SlideView needs, from the display view; null before anything is learned. */
export function previewStyle(view: StyleProfileView | null, name: string): StyleProfile | null {
  if (!view) return null
  const base = createDraftProfile('preview', name, EPOCH)
  return { ...base, tokens: view.tokens, components: view.components, version: view.version }
}

/** The slide to draw: Claude's test slide, else the provisional one. */
export const slideFor = (view: StyleProfileView): Slide => view.testSlide ?? provisionalTestSlide()
