/** Sample data for the slide gallery: the design fixtures plus one slide that shows every element type. */
import deckJson from '../../../../../design/fixtures/deck.photosynthesis.json'
import styleJson from '../../../../../design/fixtures/style-profile.science-ks3.json'
import type { Deck, Element, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'

export const sampleDeck = deckJson as unknown as Deck
export const sampleStyle = styleJson as unknown as StyleProfile

const DIAGRAM_SVG =
  '<svg viewBox="0 0 400 240"><defs><marker id="head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
  '<path d="M0 0L8 4L0 8z" fill="#12263A"/></marker></defs>' +
  '<ellipse cx="90" cy="120" rx="70" ry="90" fill="#E3F2F1" stroke="#0E7C7B" stroke-width="4"/>' +
  '<text x="90" y="125" text-anchor="middle" font-size="22" fill="#12263A">Leaf</text>' +
  '<line x1="170" y1="120" x2="280" y2="120" stroke="#12263A" stroke-width="4" marker-end="url(#head)"/>' +
  '<circle cx="330" cy="120" r="50" fill="#FFE36E" stroke="#12263A" stroke-width="4"/>' +
  '<text x="330" y="126" text-anchor="middle" font-size="20" fill="#12263A">Glucose</text></svg>'

const elements: Element[] = [
  {
    id: 'g-title',
    type: 'text',
    role: 'title',
    styleRef: 'title',
    x: 125,
    y: 60,
    w: 1700,
    h: 100,
    paragraphs: [{ runs: [{ text: 'Every element ' }, { text: 'type', color: 'token:accent' }] }]
  },
  {
    id: 'g-list',
    type: 'text',
    role: 'body',
    styleRef: 'body',
    x: 125,
    y: 190,
    w: 800,
    h: 360,
    paragraphs: [
      {
        list: 'bullet',
        runs: [
          { text: 'Bullet with ' },
          { text: 'bold', bold: true },
          { text: ' and ' },
          { text: 'italic', italic: true }
        ]
      },
      { list: 'bullet', level: 1, runs: [{ text: 'Nested bullet' }] },
      { list: 'number', runs: [{ text: 'First step' }] },
      { list: 'number', runs: [{ text: 'Second step' }] },
      { list: 'checkbox', runs: [{ text: 'Tick-box' }] }
    ]
  },
  {
    id: 'g-diagram',
    type: 'diagram',
    x: 1000,
    y: 190,
    w: 800,
    h: 360,
    alt: 'A leaf makes glucose',
    svg: DIAGRAM_SVG
  },
  {
    id: 'g-table',
    type: 'table',
    x: 125,
    y: 600,
    w: 800,
    h: 200,
    headerRow: true,
    rows: [
      ['Reactant', 'Product'],
      ['Carbon dioxide', 'Glucose'],
      ['Water', 'Oxygen']
    ]
  },
  {
    id: 'g-rect',
    type: 'shape',
    shape: 'roundRect',
    x: 1000,
    y: 600,
    w: 220,
    h: 120,
    radius: 24,
    fill: { color: 'token:highlight' },
    stroke: { color: 'token:text', width: 6 }
  },
  {
    id: 'g-ellipse',
    type: 'shape',
    shape: 'ellipse',
    x: 1260,
    y: 600,
    w: 220,
    h: 120,
    fill: { color: 'token:chipBg', opacity: 0.6 },
    stroke: { color: 'token:accent', width: 6, dash: 'dash' }
  },
  {
    id: 'g-arrow',
    type: 'shape',
    shape: 'arrow',
    x: 1520,
    y: 640,
    w: 280,
    h: 40,
    stroke: { color: 'token:text', width: 8 }
  },
  {
    id: 'g-chips',
    type: 'chips',
    x: 125,
    y: 860,
    w: 900,
    h: 70,
    items: ['chlorophyll', 'glucose', 'stomata', 'endothermic']
  },
  {
    id: 'g-callout',
    type: 'callout',
    variant: 'mini-whiteboard',
    x: 1000,
    y: 800,
    w: 800,
    h: 160,
    label: 'Mini-whiteboards:',
    paragraphs: [{ runs: [{ text: 'Where does the glucose go?' }] }]
  }
]

/** One slide showing bullets, numbers, tick-boxes, diagram, table, shapes, chips and a callout. */
export const allElementsSlide: Slide = { id: 'gallery-all', kind: 'custom', elements }

/** A slide whose text cannot fit even at 60%: shows the "doesn't fit" badge (when badges are on). */
export const overflowSlide: Slide = {
  id: 'gallery-overflow',
  kind: 'content',
  elements: [
    {
      id: 'o-text',
      type: 'text',
      role: 'body',
      x: 125,
      y: 200,
      w: 700,
      h: 160,
      paragraphs: [{ runs: [{ text: 'This paragraph is far too long for its box. '.repeat(12) }] }]
    }
  ]
}
