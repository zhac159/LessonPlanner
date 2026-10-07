import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/assets/types'
import type { CalloutElement, Element, ImageElement, TableElement } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { exportDeckToPptx, type ExportIo } from './pptx'
import { deckWith, loadFixtureStyle, makePng, openPptx, textEl } from './testkit'

type CreditOnly = Pick<Asset, 'credit'>
const credit = (text: string, inNotes = true): CreditOnly => ({
  credit: {
    text,
    inNotes,
    provider: null,
    author: null,
    title: null,
    pageUrl: null,
    licenceUrl: null
  }
})

const picture = (over: Partial<ImageElement> = {}): ImageElement => ({
  id: 'pic',
  type: 'image',
  x: 100,
  y: 100,
  w: 400,
  h: 300,
  fit: 'cover',
  alt: 'A leaf',
  assetId: 'leaf.png',
  ...over
})

async function exportWith(
  elements: Element[],
  io: Partial<ExportIo> = {},
  slide: { notes?: string } = {},
  style: StyleProfile | null = loadFixtureStyle()
) {
  const png = await makePng(400, 300)
  const result = await exportDeckToPptx(deckWith(elements, slide), style, {
    readAsset: async () => png,
    ...io
  })
  const file = await openPptx(result.bytes)
  return { result, file, shapes: await file.slideShapes(1) }
}

const notesOf = async (file: Awaited<ReturnType<typeof openPptx>>) =>
  file.text('ppt/notesSlides/notesSlide1.xml')

describe('credits in the speaker notes', () => {
  const credits = new Map([['leaf.png', credit('Photo: Ada Lovelace, CC BY 4.0, via Openverse')]])

  it('adds the credit line to the notes when the slide is missing it', async () => {
    const { file } = await exportWith(
      [picture()],
      { assetCredits: credits },
      { notes: 'Mind the glare.' }
    )
    const notes = await notesOf(file)
    expect(notes).toContain('Mind the glare.')
    expect(notes).toContain('Picture credit: Photo: Ada Lovelace, CC BY 4.0, via Openverse')
  })

  it('writes notes even when the slide had none, and never the line twice', async () => {
    const line = 'Picture credit: Photo: Ada Lovelace, CC BY 4.0, via Openverse'
    const bare = await exportWith([picture()], { assetCredits: credits })
    expect((await notesOf(bare.file)).split(line).length - 1).toBe(1)
    const already = await exportWith(
      [picture(), picture({ id: 'pic2', x: 600 })],
      { assetCredits: credits },
      { notes: `Intro\n${line}` }
    )
    expect((await notesOf(already.file)).split(line).length - 1).toBe(1)
  })

  it('adds nothing for her own pictures, CC0, or without the library to look in', async () => {
    const own = new Map([['leaf.png', credit('Yours', false)]])
    const a = await exportWith([picture()], { assetCredits: own })
    expect(await notesOf(a.file)).not.toContain('Picture credit')
    const b = await exportWith([picture()], {}, { notes: 'Plain notes' })
    expect(await notesOf(b.file)).not.toContain('Picture credit')
  })

  it('keeps the credit the slide already carries when the asset was deleted from the library', async () => {
    const line = 'Picture credit: Made with Nano Banana Pro (AI-generated).'
    const { file } = await exportWith([picture()], { assetCredits: new Map() }, { notes: line })
    expect(await notesOf(file)).toContain(line)
  })

  it('adds the AI-made line for a generated picture', async () => {
    const made = new Map([
      ['leaf.png', credit('Picture made with Nano Banana Pro (AI-generated).')]
    ])
    const { file } = await exportWith([picture()], { assetCredits: made })
    expect(await notesOf(file)).toContain(
      'Picture credit: Picture made with Nano Banana Pro (AI-generated).'
    )
  })
})

describe('pictures, spots and the report', () => {
  it('embeds the asset and writes no library names (name, tags, description stay out)', async () => {
    const { shapes, file } = await exportWith([
      picture({ name: 'school_logo', alt: 'The school logo' })
    ])
    expect(shapes.filter((s) => s.kind === 'picture')).toHaveLength(1)
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toContain('descr="The school logo"')
  })

  it('reports skipped spots with their slide and unreadable pictures by name', async () => {
    const spot = picture({
      id: 'spot',
      assetId: undefined,
      alt: 'Leaf',
      placeholder: { description: 'A leaf in sunlight, close up', kind: 'photo' }
    })
    const lost = picture({ id: 'lost', assetId: 'gone.png', alt: 'Cave scene', x: 600 })
    const { result, shapes } = await exportWith([spot, lost], {
      readAsset: async (id) => (id === 'gone.png' ? undefined : await makePng(10, 10))
    })
    expect(result.skippedSpots).toEqual([{ slide: 1, description: 'A leaf in sunlight, close up' }])
    expect(result.missingAssets).toEqual(['Cave scene'])
    expect(shapes.map((s) => s.name)).toEqual(['lost'].concat(['lost caption']))
  })

  it('draws a missing picture in a neutral tint, never the profile one-off colour', async () => {
    const style = loadFixtureStyle()
    style.tokens.colors.placeholder = { hex: '#FFB800', label: 'Orange', usage: 'one-off' }
    const { shapes } = await exportWith(
      [picture({ assetId: 'gone.png' })],
      { readAsset: async () => undefined },
      {},
      style
    )
    expect(shapes.find((s) => s.name === 'pic')?.fill).toBe('E5E7EB')
  })
})

describe('defects found in the example decks', () => {
  it('keeps her case for a kicker whose profile component has no uppercase flag', async () => {
    const style = loadFixtureStyle()
    style.components.kicker = { description: 'Phase label', bold: true }
    const kicker = textEl('k', 'Input:', { role: 'kicker' })
    const caps = await exportWith([kicker], {}, {}, loadFixtureStyle())
    const mine = await exportWith([kicker], {}, {}, style)
    expect(mine.shapes.find((s) => s.name === 'k')?.text).toBe('Input:')
    expect(caps.shapes.find((s) => s.name === 'k')?.text).toBe(
      loadFixtureStyle().components.kicker?.uppercase ? 'INPUT:' : 'Input:'
    )
    const plain = await exportWith([kicker], {}, {}, null)
    expect(plain.shapes.find((s) => s.name === 'k')?.text).toBe('INPUT:')
  })

  it('never makes the table header text the colour of its fill', async () => {
    const style = loadFixtureStyle()
    style.tokens.colors.accent = { hex: '#FFFFFF', label: 'White', usage: 'light accent' }
    const table: TableElement = {
      id: 't',
      type: 'table',
      x: 0,
      y: 0,
      w: 800,
      h: 200,
      rows: [
        ['Singular', 'Plural'],
        ['mouse', 'mice']
      ],
      headerRow: true
    }
    const { file } = await exportWith([table], {}, {}, style)
    const xml = await file.text('ppt/slides/slide1.xml')
    const head = /<a:tc>[\s\S]*?Singular[\s\S]*?<\/a:tc>/.exec(xml)?.[0] ?? ''
    const text = /<a:rPr[^>]*>\s*<a:solidFill><a:srgbClr val="(\w+)"/.exec(head)?.[1]
    const fill = /<\/a:lnB><a:solidFill><a:srgbClr val="(\w+)"/.exec(head)?.[1]
    expect(fill).toBe('FFFFFF')
    expect(text).toBeDefined()
    expect(text).not.toBe(fill)
  })

  it('draws the speech bubble as a freeform wedge with an outline, text readable on it', async () => {
    const style = loadFixtureStyle()
    style.components['callout.speech-bubble'] = {
      description: 'White wedge bubble',
      font: 'body',
      color: '#FFFFFF',
      fill: '#FFFFFF'
    }
    const bubble: CalloutElement = {
      id: 'b',
      type: 'callout',
      variant: 'speech-bubble',
      tail: 'bottom-right',
      x: 1260,
      y: 715,
      w: 600,
      h: 280,
      paragraphs: [{ runs: [{ text: 'What are the plural nouns?' }] }]
    }
    const { file, shapes } = await exportWith([bubble], {}, {}, style)
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toContain('<a:custGeom>')
    expect(xml).toMatch(/<a:quadBezTo>/)
    expect(xml).toMatch(/<a:ln w="25400"/) // 2 pt outline
    const body = shapes.find((s) => s.name === 'b')!
    // the frame holds the tail: it starts at the body's left and extends below the body
    expect(body.x).toBeCloseTo(1260, 0)
    expect(body.h).toBeGreaterThan(280)
    const run = shapes.find((s) => s.name === 'b text')!.paragraphs[0][0]
    expect(run.color).toBe('000000')
  })

  it('leaves unresolved date fields out of the text, but keeps a date she typed', async () => {
    const { shapes } = await exportWith([
      textEl('a', 'Monday {{date}}'),
      textEl('b', 'Monday 5th October 2026', { y: 300 })
    ])
    expect(shapes.find((s) => s.name === 'a')?.text).toBe('Monday')
    expect(shapes.find((s) => s.name === 'b')?.text).toBe('Monday 5th October 2026')
  })
})
