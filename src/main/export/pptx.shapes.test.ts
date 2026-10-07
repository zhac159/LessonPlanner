import { describe, expect, it } from 'vitest'
import type { Element } from '@shared/deck/types'
import { exportOne as run, named } from './testkit'

describe('shapes and tables', () => {
  const shape = (extra: Record<string, unknown>): Element =>
    ({ id: 'sh', type: 'shape', shape: 'rect', x: 10, y: 20, w: 300, h: 100, ...extra }) as Element

  it('writes fill with opacity, stroke, dash and corner radius', async () => {
    const { shapes, file } = await run([
      shape({
        shape: 'roundRect',
        radius: 20,
        fill: { color: '#FF0000', opacity: 0.25 },
        stroke: { color: 'token:accent', width: 8, dash: 'dash' }
      })
    ])
    expect(shapes[0]).toMatchObject({ geometry: 'roundRect', fill: 'FF0000' })
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toContain('<a:alpha val="25000"/>')
    expect(xml).toContain('<a:prstDash val="dash"/>')
    expect(xml).toMatch(/<a:ln w="50800"/) // 8 units = 4 pt
    expect(xml).toContain('0E7C7B')
  })

  it('draws ellipses, lines and arrows (arrowhead at the far end)', async () => {
    const { shapes, file } = await run([
      shape({ id: 'e', shape: 'ellipse' }),
      shape({ id: 'l', shape: 'line', h: 0, stroke: { color: '#000000', width: 4 } }),
      shape({ id: 'a', shape: 'arrow' })
    ])
    expect(named(shapes, 'e').geometry).toBe('ellipse')
    expect(named(shapes, 'l').geometry).toBe('line')
    expect(named(shapes, 'a').geometry).toBe('line')
    expect(await file.text('ppt/slides/slide1.xml')).toContain('<a:tailEnd type="triangle"')
  })

  it('caps an oversized radius at a full pill', async () => {
    const { file } = await run([shape({ shape: 'roundRect', radius: 999 })])
    expect(await file.text('ppt/slides/slide1.xml')).toContain(
      '<a:gd name="adj" fmla="val 50000"/>'
    )
  })

  it('builds a table with a styled header, scaled column widths and padded ragged rows', async () => {
    const table = {
      id: 'tb',
      type: 'table',
      x: 100,
      y: 100,
      w: 900,
      h: 300,
      headerRow: true,
      colWidths: [100, 200],
      rows: [['A', 'B'], ['only one']]
    } as Element
    const { file, shapes } = await run([table])
    expect(shapes[0]).toMatchObject({ kind: 'table', x: 100, y: 100 })
    const xml = await file.text('ppt/slides/slide1.xml')
    expect(xml).toContain('<a:gridCol w="1905000"/>') // 300 units
    expect(xml).toContain('<a:gridCol w="3810000"/>') // 600 units
    expect(xml.match(/<a:tc>/g)).toHaveLength(4)
    expect(xml).toContain('0E7C7B') // header fill from the accent token
  })

  it('leaves an empty table out with a warning', async () => {
    const table = { id: 'tb', type: 'table', x: 0, y: 0, w: 10, h: 10, headerRow: false, rows: [] }
    const { shapes, warnings } = await run([table as Element])
    expect(shapes).toHaveLength(0)
    expect(warnings).toEqual(['Slide 1: an empty table was left out.'])
  })
})

describe('chips and callouts', () => {
  it('wraps chips onto several rows inside their box', async () => {
    const chips = {
      id: 'c',
      name: 'words',
      type: 'chips',
      styleRef: 'chip',
      x: 100,
      y: 100,
      w: 420,
      h: 200,
      items: ['photosynthesis', 'chlorophyll', 'glucose', 'endothermic']
    } as Element
    const { shapes } = await run([chips])
    const rows = new Set(shapes.map((s) => Math.round(s.y)))
    expect(shapes).toHaveLength(4)
    expect(rows.size).toBeGreaterThan(1)
    for (const s of shapes) expect(s.x + s.w).toBeLessThanOrEqual(100 + 420 + 2)
  })

  it('writes a callout without a label as plain text on the box', async () => {
    const callout = {
      id: 'co',
      type: 'callout',
      variant: 'warning',
      x: 0,
      y: 0,
      w: 800,
      h: 100,
      paragraphs: [{ runs: [{ text: 'Careful!' }] }]
    } as Element
    const { shapes } = await run([callout])
    expect(named(shapes, 'co').fill).toBe('FFE36E') // default highlight
    expect(named(shapes, 'co text').paragraphs[0][0].bold).toBe(false)
  })
})
