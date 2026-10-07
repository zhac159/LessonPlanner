import { describe, expect, it } from 'vitest'
import type { Element } from '@shared/deck/types'
import { exportDeckToPptx } from './pptx'
import {
  deckWith,
  exportOne as run,
  loadFixtureStyle,
  named,
  openPptx,
  textEl,
  NO_ASSETS as none
} from './testkit'

const style = loadFixtureStyle()

describe('slide-level behaviour', () => {
  it('paints in array order, with z lifting an element above later ones', async () => {
    const a = shapeAt('a', 1, 5)
    const b = shapeAt('b', 2)
    const c = shapeAt('c', 3, -1)
    const { shapes } = await run([a, b, c])
    expect(shapes.map((s) => s.name)).toEqual(['c', 'b', 'a'])
  })

  it('uses the background fill, else the profile background, else white', async () => {
    const withBg = await exportDeckToPptx(
      deckWith([], { background: { color: '#112233' } }),
      style,
      none
    )
    expect(await xmlOf(withBg.bytes)).toContain(
      '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="112233"/>'
    )
    const plain = await exportDeckToPptx(deckWith([]), style, none)
    expect(await xmlOf(plain.bytes)).toContain('val="FFFFFF"')
  })

  it('exports a deck with no style profile using Calibri and the default palette', async () => {
    const { shapes, file } = await run([shapeAt('a', 1), textEl('t', 'Hi')], none, false)
    expect(shapes).toHaveLength(2)
    expect(await file.text('ppt/slides/slide1.xml')).toContain('typeface="Calibri"')
  })

  it('exports an empty deck as one blank slide with a warning', async () => {
    const deck = { ...deckWith([]), slides: [] }
    const { bytes, warnings } = await exportDeckToPptx(deck, style, none)
    const file = await openPptx(bytes)
    expect(file.slideCount).toBe(1)
    expect(warnings).toEqual([
      'This lesson has no slides yet, so the file contains one blank slide.'
    ])
  })

  it('keeps notes line breaks', async () => {
    const deck = deckWith([], { notes: 'first\nsecond' })
    const { bytes } = await exportDeckToPptx(deck, style, none)
    const notes = await (await openPptx(bytes)).text('ppt/notesSlides/notesSlide1.xml')
    expect(notes).toMatch(/first[\s\S]*second/)
  })

  it('replaces an invalid colour with black and says so', async () => {
    const bad = {
      id: 'bad',
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      fill: { color: '#zzz' }
    } as Element
    const { shapes, warnings } = await run([bad])
    expect(shapes[0].fill).toBe('000000')
    expect(warnings[0]).toContain('colour')
  })

  it('warns once when the profile says a font is not installed', async () => {
    const other = structuredClone(style)
    other.tokens.fonts.body.available = false
    const deck = deckWith([textEl('a', 'x'), textEl('b', 'y')])
    const { warnings } = await exportDeckToPptx(deck, other, none)
    expect(warnings).toEqual([
      'The font “Lexend” may not be installed on this computer, so PowerPoint could substitute another one.'
    ])
  })

  it('keeps going when one element cannot be written', async () => {
    const broken = {
      id: 'x',
      name: 'weird',
      type: 'unknown',
      x: 0,
      y: 0,
      w: 1,
      h: 1
    } as unknown as Element
    const { shapes, warnings } = await run([broken, textEl('ok', 'fine')])
    expect(named(shapes, 'ok').text).toBe('fine')
    expect(warnings).toEqual([]) // unknown types are skipped silently by the dispatcher
  })

  it('reports an element whose writer throws and still exports the rest', async () => {
    const throwing = { ...textEl('boom', 'x'), paragraphs: null } as unknown as Element
    const { shapes, warnings } = await run([throwing, textEl('ok', 'fine')])
    expect(named(shapes, 'ok').text).toBe('fine')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^Slide 1: “boom” could not be exported and was left out/)
  })
})

function shapeAt(id: string, n: number, z?: number): Element {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x: n * 10,
    y: 0,
    w: 10,
    h: 10,
    z,
    fill: { color: '#112233' }
  } as Element
}

async function xmlOf(bytes: Uint8Array): Promise<string> {
  return (await openPptx(bytes)).text('ppt/slides/slide1.xml')
}

describe('installed fonts', () => {
  const deck = deckWith([textEl('a', 'x')])

  it('warns when the installed-font list lacks the profile font, even if the profile says available', async () => {
    const { warnings } = await exportDeckToPptx(deck, style, {
      ...none,
      installedFonts: new Set(['calibri'])
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('“Lexend”')
  })

  it('stays quiet when the font is installed', async () => {
    const { warnings } = await exportDeckToPptx(deck, style, {
      ...none,
      installedFonts: new Set(['lexend'])
    })
    expect(warnings).toEqual([])
  })
})
