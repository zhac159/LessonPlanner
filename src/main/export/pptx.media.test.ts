import { describe, expect, it } from 'vitest'
import type { Element } from '@shared/deck/types'
import { exportOne as run, makePng, named } from './testkit'

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#0e7c7b"/></svg>'

describe('images and diagrams', () => {
  const image = (extra: Partial<Element> = {}): Element =>
    ({
      id: 'img',
      type: 'image',
      x: 100,
      y: 100,
      w: 400,
      h: 200,
      fit: 'cover',
      alt: 'A leaf',
      assetId: 'leaf.png',
      ...extra
    }) as Element

  it('embeds an asset as a picture at its box and crops to fill for cover', async () => {
    const png = await makePng(800, 800)
    const { file, shapes, warnings } = await run([image()], { readAsset: async () => png })
    const pic = shapes.find((s) => s.kind === 'picture')!
    expect(pic).toMatchObject({ x: 100, y: 100, w: 400, h: 200 })
    expect(file.names.some((n) => n.startsWith('ppt/media/'))).toBe(true)
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toMatch(/<a:srcRect l="0" r="0" t="25000" b="25000"\/>/) // square image into a 2:1 box
    expect(xml).toContain('descr="A leaf"')
    expect(warnings).toEqual([])
  })

  it('letterboxes inside the box for contain, centred', async () => {
    const png = await makePng(100, 100)
    const { shapes } = await run([image({ fit: 'contain' })], { readAsset: async () => png })
    const pic = shapes.find((s) => s.kind === 'picture')!
    expect(pic.h).toBeCloseTo(200, 0)
    expect(pic.w).toBeCloseTo(200, 0)
    expect(pic.x).toBeCloseTo(100 + 100, 0)
  })

  it('rasterises an SVG asset before embedding it', async () => {
    const svg = new TextEncoder().encode(SVG)
    const { file, shapes } = await run([image()], { readAsset: async () => svg })
    expect(shapes.some((s) => s.kind === 'picture')).toBe(true)
    expect(file.names.some((n) => n.endsWith('.png'))).toBe(true)
  })

  it('skips a picture spot: no shape, no caption, one warning', async () => {
    const el = image({ assetId: undefined, placeholder: { description: 'Photo: leaf' } })
    const { shapes, warnings } = await run([el])
    expect(shapes).toEqual([])
    expect(warnings).toEqual(['Slide 1: the empty picture spot “Photo: leaf” was left out.'])
  })

  it('a filled spot exports its picture and keeps the placeholder as provenance only', async () => {
    const png = await makePng(400, 200)
    const el = image({ placeholder: { description: 'Photo: leaf', kind: 'photo' } })
    const { shapes, warnings } = await run([el], { readAsset: async () => png })
    expect(shapes.filter((s) => s.kind === 'picture')).toHaveLength(1)
    expect(shapes.some((s) => s.text.includes('Photo: leaf'))).toBe(false)
    expect(warnings).toEqual([])
  })

  it('warns and shows a placeholder when the asset file is missing', async () => {
    const { shapes, warnings } = await run([image()])
    expect(shapes.some((s) => s.kind === 'picture')).toBe(false)
    expect(named(shapes, 'img caption').text).toBe('A leaf')
    expect(warnings).toEqual([
      'Slide 1: the picture “A leaf” could not be found, so a placeholder was used.'
    ])
  })

  it('warns when the asset is not an image PowerPoint can use', async () => {
    const junk = new TextEncoder().encode('not an image')
    const { warnings, shapes } = await run([image()], { readAsset: async () => junk })
    expect(warnings[0]).toContain('is not a PNG, JPEG, GIF or SVG')
    expect(shapes.some((s) => s.kind === 'picture')).toBe(false)
  })

  it('draws a diagram through a custom rasteriser at 2x the box width', async () => {
    const calls: number[] = []
    const png = await makePng(100, 50)
    const io = {
      readAsset: async () => undefined,
      rasteriseSvg: async (_svg: string, width: number) => {
        calls.push(width)
        return png
      }
    }
    const diagram = {
      id: 'd',
      type: 'diagram',
      x: 0,
      y: 0,
      w: 500,
      h: 300,
      svg: SVG,
      alt: 'Chart'
    } as Element
    const { shapes } = await run([diagram], io)
    expect(calls).toEqual([1000])
    expect(shapes.find((s) => s.kind === 'picture')).toBeDefined()
  })

  it('falls back to a placeholder and a warning when the rasteriser throws or returns junk', async () => {
    const diagram = {
      id: 'd',
      type: 'diagram',
      x: 0,
      y: 0,
      w: 500,
      h: 300,
      svg: SVG,
      alt: 'Chart'
    } as Element
    const boom = await run([diagram], {
      readAsset: async () => undefined,
      rasteriseSvg: async () => Promise.reject(new Error('boom'))
    })
    expect(boom.warnings).toEqual([
      'Slide 1: the diagram “Chart” could not be drawn, so a placeholder was used.'
    ])
    expect(named(boom.shapes, 'd caption').text).toBe('Chart')
    const junk = await run([diagram], {
      readAsset: async () => undefined,
      rasteriseSvg: async () => new Uint8Array([1, 2, 3])
    })
    expect(junk.warnings).toHaveLength(1)
  })

  it('really rasterises with resvg by default, and survives broken SVG', async () => {
    const good = { id: 'g', type: 'diagram', x: 0, y: 0, w: 400, h: 200, svg: SVG, alt: 'ok' }
    const bad = { ...good, id: 'b', svg: '<svg><oops' }
    const { shapes, warnings } = await run([good, bad] as Element[])
    expect(shapes.filter((s) => s.kind === 'picture')).toHaveLength(1)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('could not be drawn')
  })
})
