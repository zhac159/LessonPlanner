import { describe, expect, it } from 'vitest'
import type { Element } from '@shared/deck/types'
import { exportDeckToPptx } from './pptx'
import {
  deckWith,
  exportOne as run,
  loadFixtureDeck,
  loadFixtureStyle,
  named,
  openPptx,
  textEl,
  NO_ASSETS as none
} from './testkit'

const style = loadFixtureStyle()

describe('text', () => {
  it('survives hostile text: XML specials, control characters, lone surrogates', async () => {
    const hostile = 'a <b> & "c" \'d\' ]]> <!-- x --> \u0000\u0008\uD800 é 😀'
    const { shapes } = await run([textEl('t', hostile)])
    expect(named(shapes, 't').text).toBe('a <b> & "c" \'d\' ]]> <!-- x -->  é 😀')
  })

  it('keeps hostile text in alt text, titles, notes and names valid too', async () => {
    const deck = deckWith(
      [
        {
          id: 'i',
          type: 'image',
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          fit: 'cover',
          alt: '"><script>&',
          placeholder: { description: '<x>' }
        }
      ],
      { notes: 'n<1>&\u0001' },
      'T<i>&"tle'
    )
    const { bytes } = await exportDeckToPptx(deck, style, none)
    const file = await openPptx(bytes) // throws on any malformed part
    expect(await file.text('ppt/notesSlides/notesSlide1.xml')).toContain('n&lt;1&gt;&amp;')
  })

  it('flattens line breaks inside a run so list items stay single paragraphs', async () => {
    const { shapes } = await run([textEl('t', 'one\ntwo')])
    expect(named(shapes, 't').paragraphs).toHaveLength(1)
    expect(named(shapes, 't').text).toBe('one two')
  })

  it('writes an empty paragraph list as an empty text box', async () => {
    const empty = { ...textEl('t', ''), paragraphs: [] } as Element
    const { shapes } = await run([empty])
    expect(named(shapes, 't').text).toBe('')
  })

  it('applies element overrides: font size, alignment, rotation, per-run bold/italic', async () => {
    const el = {
      ...textEl('t', ''),
      fontSizePt: 33,
      align: 'center',
      valign: 'middle',
      rotation: 10,
      paragraphs: [{ runs: [{ text: 'x', bold: true, italic: true, color: '#abc' }] }]
    } as Element
    const { shapes, file } = await run([el])
    const t = named(shapes, 't')
    expect(t.rotation).toBe(10)
    expect(t.paragraphs[0][0]).toMatchObject({ sizePt: 33, bold: true, color: 'AABBCC' })
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toContain('algn="ctr"')
    expect(xml).toContain('anchor="ctr"')
    expect(xml).toContain(' i="1"')
  })

  it('turns off shrink-to-fit when autoFit is none', async () => {
    const off = { ...textEl('t', 'x'), autoFit: 'none' } as Element
    const { file } = await run([off])
    expect(await file.text('ppt/slides/slide1.xml')).not.toContain('normAutofit')
  })

  it('never leaves paragraph properties between runs', async () => {
    const deck = loadFixtureDeck()
    const { bytes } = await exportDeckToPptx(deck, style, none)
    const file = await openPptx(bytes)
    for (let i = 1; i <= deck.slides.length; i++) {
      const xml = await file.text(`ppt/slides/slide${i}.xml`)
      for (const [, body] of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) {
        const count = body.match(/<a:pPr\b/g)?.length ?? 0
        expect(count).toBeLessThanOrEqual(1)
        if (count === 1) expect(body.startsWith('<a:pPr')).toBe(true)
      }
    }
  })
})
