/** The photosynthesis fixture plus a slide using every element type (real PowerPoint check). */
import type { Deck } from '@shared/deck/types'
import { loadFixtureDeck } from './testkit'

/**
 * The fixture deck plus a "kitchen sink" slide using every element type, for the real PowerPoint
 * check (`KEEP_SAMPLE=1`). Its image asset id is `photo.png`.
 */
export function buildSampleDeck(): Deck {
  const deck = loadFixtureDeck()
  deck.slides.push({
    id: 's4',
    kind: 'custom',
    notes: 'First line of notes.\nSecond line with <tags> & “quotes”.',
    elements: [
      {
        id: 'k-title',
        type: 'text',
        role: 'title',
        styleRef: 'title',
        x: 125,
        y: 60,
        w: 1700,
        h: 110,
        paragraphs: [
          { runs: [{ text: 'Every element ' }, { text: 'type', color: 'token:accent' }] }
        ]
      },
      {
        id: 'k-list',
        type: 'text',
        role: 'body',
        styleRef: 'body',
        x: 125,
        y: 200,
        w: 800,
        h: 260,
        paragraphs: [
          {
            list: 'bullet',
            runs: [
              { text: 'Bold ', bold: true },
              { text: 'italic ', italic: true },
              { text: 'underlined', underline: true }
            ]
          },
          { list: 'bullet', level: 1, runs: [{ text: 'Nested point' }] },
          { list: 'none', runs: [{ text: 'Plain <b>&</b> “smart” text' }] }
        ]
      },
      {
        id: 'k-photo',
        name: 'photo',
        type: 'image',
        x: 980,
        y: 200,
        w: 400,
        h: 300,
        fit: 'cover',
        alt: 'A wide photo',
        assetId: 'photo.png'
      },
      {
        id: 'k-diagram',
        name: 'diagram',
        type: 'diagram',
        x: 1440,
        y: 200,
        w: 380,
        h: 300,
        alt: 'Diagram',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" rx="8" fill="#e3f2f1"/><circle cx="40" cy="40" r="22" fill="#0e7c7b"/><path d="M70 20 L110 40 L70 60 Z" fill="#ffe36e" stroke="#12263a" stroke-width="2"/><text x="8" y="74" font-size="9" fill="#12263a">Diagram</text></svg>'
      },
      {
        id: 'k-chips',
        type: 'chips',
        styleRef: 'chip',
        x: 125,
        y: 500,
        w: 800,
        h: 130,
        items: ['photosynthesis', 'chlorophyll', 'glucose', 'endothermic', 'respiration', 'stomata']
      },
      {
        id: 'k-table',
        name: 'table',
        type: 'table',
        x: 980,
        y: 540,
        w: 840,
        h: 200,
        headerRow: true,
        colWidths: [300, 540],
        rows: [
          ['Word', 'Meaning'],
          ['Chlorophyll', 'Green pigment'],
          ['Glucose', 'A sugar made in leaves']
        ]
      },
      {
        id: 'k-round',
        type: 'shape',
        shape: 'roundRect',
        x: 125,
        y: 680,
        w: 300,
        h: 120,
        radius: 30,
        fill: { color: 'token:chipBg' },
        stroke: { color: 'token:accent', width: 6 }
      },
      {
        id: 'k-ellipse',
        type: 'shape',
        shape: 'ellipse',
        x: 470,
        y: 680,
        w: 160,
        h: 120,
        fill: { color: '#FF8800', opacity: 0.5 }
      },
      {
        id: 'k-line',
        type: 'shape',
        shape: 'line',
        x: 125,
        y: 850,
        w: 500,
        h: 0,
        stroke: { color: 'token:text', width: 6, dash: 'dash' }
      },
      {
        id: 'k-arrow',
        type: 'shape',
        shape: 'arrow',
        x: 700,
        y: 700,
        w: 240,
        h: 80,
        stroke: { color: 'token:accent', width: 8 }
      },
      {
        id: 'k-rot',
        type: 'shape',
        shape: 'rect',
        x: 700,
        y: 850,
        w: 200,
        h: 80,
        rotation: 15,
        fill: { color: 'token:highlight' }
      },
      {
        id: 'k-call',
        type: 'callout',
        variant: 'mini-whiteboard',
        styleRef: 'callout.mini-whiteboard',
        x: 980,
        y: 800,
        w: 840,
        h: 140,
        label: 'Talk:',
        paragraphs: [
          { runs: [{ text: 'Explain it to your partner.' }] },
          { runs: [{ text: 'Second paragraph.' }] }
        ]
      }
    ]
  })
  return deck
}
