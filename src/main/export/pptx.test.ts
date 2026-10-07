import { mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isPictureSpot } from '@shared/assets/spots'
import { exportDeckToPptx } from './pptx'
import { buildSampleDeck } from './sampleDeck'
import { loadFixtureDeck, loadFixtureStyle, makePng, openPptx, type ShapeInfo } from './testkit'

const TOLERANCE = 2 // units, per the acceptance criteria
const style = loadFixtureStyle()

async function exportFixture() {
  const deck = loadFixtureDeck()
  const png = await makePng(400, 300)
  const result = await exportDeckToPptx(deck, style, { readAsset: async () => png })
  return { deck, result, file: await openPptx(result.bytes) }
}

/** Finds the shape for a deck element by the name the exporter gives it. */
const byName = (shapes: ShapeInfo[], name: string): ShapeInfo => {
  const found = shapes.find((s) => s.name === name)
  if (!found) throw new Error(`no shape named ${name}: ${shapes.map((s) => s.name).join(', ')}`)
  return found
}

describe('exportDeckToPptx: photosynthesis fixture', () => {
  it('produces a well-formed package with one slide part per slide', async () => {
    const { deck, file } = await exportFixture()
    expect(file.slideCount).toBe(deck.slides.length)
    const types = await file.text('[Content_Types].xml')
    expect(types).toContain('presentationml.slide+xml')
    expect(types).toContain('presentationml.notesSlide+xml')
    expect(types).toContain('Extension="png"')
    expect(await file.text('ppt/presentation.xml')).toMatch(/cx="12192000"\s+cy="6858000"/)
  })

  it('places every element within 2 units of its design position', async () => {
    const { deck, file } = await exportFixture()
    for (const [i, slide] of deck.slides.entries()) {
      const shapes = await file.slideShapes(i + 1)
      for (const el of slide.elements.filter((e) => e.type !== 'chips' && !isPictureSpot(e))) {
        const shape = byName(shapes, el.name ?? el.id)
        for (const key of ['x', 'y', 'w', 'h'] as const) {
          expect(Math.abs(shape[key] - el[key]), `${el.id}.${key}`).toBeLessThanOrEqual(TOLERANCE)
        }
      }
    }
  })

  it('keeps the two-colour title: navy text then a teal run', async () => {
    const { file } = await exportFixture()
    const title = byName(await file.slideShapes(1), 's1-title')
    const [runs] = title.paragraphs
    expect(runs.map((r) => r.text)).toEqual(['How do plants ', 'make food?'])
    expect(runs.map((r) => r.color)).toEqual(['12263A', '0E7C7B'])
    expect(runs.every((r) => r.bold && r.sizePt === 60 && r.font === 'Lexend')).toBe(true)
  })

  it('resolves the left band token to the profile accent', async () => {
    const { file } = await exportFixture()
    const band = byName(await file.slideShapes(2), 's2-band')
    expect(band.fill).toBe('0E7C7B')
    expect(band.geometry).toBe('rect')
  })

  it('keeps the yellow rounded callout with a bold label first', async () => {
    const { file } = await exportFixture()
    const shapes = await file.slideShapes(3)
    const box = byName(shapes, 'mini-whiteboard question')
    expect(box.geometry).toBe('roundRect')
    expect(box.fill).toBe('FFE36E')
    const [runs] = byName(shapes, 'mini-whiteboard question text').paragraphs
    expect(runs[0]).toMatchObject({ text: 'Mini-whiteboards: ', bold: true })
    expect(runs.map((r) => r.text).join('')).toBe(
      'Mini-whiteboards: What do you think a plant “eats”?'
    )
  })

  it('draws kicker text uppercase with the teal accent colour', async () => {
    const { file } = await exportFixture()
    const kicker = byName(await file.slideShapes(1), 's1-kicker')
    expect(kicker.text).toBe('LESSON 3 · YEAR 8 SCIENCE')
    expect(kicker.paragraphs[0][0]).toMatchObject({ color: '0E7C7B', bold: true, sizePt: 13 })
  })

  it('writes numbered and checkbox lists as real bullets, one paragraph per item', async () => {
    const { file } = await exportFixture()
    const numbered = await file.text('ppt/slides/slide2.xml')
    expect(numbered).toContain('<a:buAutoNum')
    expect(byName(await file.slideShapes(2), 's2-qs').paragraphs).toHaveLength(3)
    const checks = await file.text('ppt/slides/slide3.xml')
    expect(checks).toMatch(/buChar char="(☐|&#x2610;)"/)
  })

  it('lays key-word chips out as one rounded pill each, inside the chip box', async () => {
    const { file } = await exportFixture()
    const pills = (await file.slideShapes(3)).filter((s) => s.name.startsWith('key words'))
    expect(pills.map((p) => p.text)).toEqual(['chlorophyll', 'glucose', 'endothermic'])
    for (const pill of pills) {
      expect(pill.geometry).toBe('roundRect')
      expect(pill.fill).toBe('E3F2F1')
      expect(pill.paragraphs[0][0]).toMatchObject({ color: '0B5E5D', bold: true })
      expect(pill.x).toBeGreaterThanOrEqual(125 - TOLERANCE)
      expect(pill.x + pill.w).toBeLessThanOrEqual(125 + 940 + TOLERANCE)
      expect(pill.y).toBeCloseTo(740, 0)
    }
    expect(pills[1].x).toBeGreaterThan(pills[0].x + pills[0].w)
  })

  it('leaves the picture spot out: no shape, no caption, a warning and a report entry', async () => {
    const { file, result } = await exportFixture()
    const shapes = await file.slideShapes(3)
    expect(shapes.some((s) => s.name === 'photo' || s.name === 'photo caption')).toBe(false)
    expect(shapes.some((s) => s.text.includes('Photo: leaf in sunlight'))).toBe(false)
    expect(result.skippedSpots).toEqual([{ slide: 3, description: 'Photo: leaf in sunlight' }])
    expect(result.warnings).toEqual([
      'Slide 3: the empty picture spot “Photo: leaf in sunlight” was left out.'
    ])
  })

  it('carries speaker notes onto notes slides', async () => {
    const { deck, file } = await exportFixture()
    for (let i = 1; i <= deck.slides.length; i++) {
      const notes = await file.text(`ppt/notesSlides/notesSlide${i}.xml`)
      expect(notes).toContain(deck.slides[i - 1].notes!.split('.')[0])
    }
  })

  it('embeds a diagram as a 2x PNG picture at its box', async () => {
    const deck = loadFixtureDeck()
    deck.slides[2].elements.push({
      id: 'diag',
      type: 'diagram',
      name: 'leaf diagram',
      x: 200,
      y: 300,
      w: 500,
      h: 300,
      alt: 'Leaf cross-section',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#2a9d8f"/><text x="5" y="30">Leaf</text></svg>'
    })
    const { bytes, warnings } = await exportDeckToPptx(deck, style, {
      readAsset: async () => undefined
    })
    const file = await openPptx(bytes)
    const pic = (await file.slideShapes(3)).find((s) => s.kind === 'picture')!
    expect(pic.name).toBe('leaf diagram')
    // 'contain': the 100x60 ratio fits a 500x300 box exactly
    expect(pic).toMatchObject({ x: 200, y: 300 })
    expect(Math.abs(pic.w - 500)).toBeLessThanOrEqual(TOLERANCE)
    expect(Math.abs(pic.h - 300)).toBeLessThanOrEqual(TOLERANCE)
    const media = file.names.filter((n) => n.startsWith('ppt/media/'))
    expect(media).toHaveLength(1)
    const png = await file.zip.file(media[0])!.async('uint8array')
    const width = new DataView(png.buffer, png.byteOffset).getUint32(16)
    expect(width).toBe(1000) // 500 units x 2
    expect(warnings.filter((w) => !w.includes('picture spot'))).toEqual([])
  })

  it('sets document properties without personal data', async () => {
    const { file } = await exportFixture()
    const core = await file.text('docProps/core.xml')
    expect(core).toContain('Y8 Science — Photosynthesis')
    expect(core).toContain('Slide Planner')
  })
})

describe('sample for the real PowerPoint check', () => {
  // KEEP_SAMPLE=1 npm run -s check -- unit -f export/pptx, then scripts/verify-pptx-com.ps1
  it.runIf(process.env.KEEP_SAMPLE === '1')('writes .artifacts/sample.pptx', async () => {
    const photo = await makePng(1600, 900, '#7fb069')
    const { bytes, warnings } = await exportDeckToPptx(buildSampleDeck(), style, {
      readAsset: async (id) => (id === 'photo.png' ? photo : undefined)
    })
    mkdirSync('.artifacts', { recursive: true })
    writeFileSync('.artifacts/sample.pptx', bytes)
    const plain = await exportDeckToPptx(buildSampleDeck(), null, { readAsset: async () => photo })
    writeFileSync('.artifacts/sample-plain.pptx', plain.bytes)
    expect(warnings).toEqual([])
  })
})
