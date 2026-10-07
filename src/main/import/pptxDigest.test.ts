import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { digestPptx } from './pptxDigest'
import { makePptx } from './testing'

const deck = () =>
  makePptx([
    { title: 'Photosynthesis', body: 'Plants make food', shape: 'FFE36E' },
    { title: 'Key words', body: 'chlorophyll' },
    { title: 'Plenary' }
  ])

const rebuild = async (bytes: Uint8Array, edit: (zip: JSZip) => void): Promise<Uint8Array> => {
  const zip = await JSZip.loadAsync(bytes)
  edit(zip)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('digestPptx', () => {
  it('reads slide count, theme colours and theme fonts', async () => {
    const digest = await digestPptx(await deck())
    expect(digest.slideCount).toBe(3)
    expect(digest.slides).toHaveLength(3)
    expect(digest.theme.fonts).toEqual({ major: 'Lexend', minor: 'Lexend' })
    expect(digest.theme.colors.accent1).toMatch(/^#[0-9A-F]{6}$/)
    expect(Object.keys(digest.theme.colors)).toEqual(
      expect.arrayContaining(['dk1', 'lt1', 'accent1'])
    )
  })

  it('reads text runs with size, weight, colour and font', async () => {
    const [first] = (await digestPptx(await deck())).slides
    const title = first.shapes.find((s) => s.paragraphs?.[0].runs[0].text === 'Photosynthesis')
    expect(title?.kind).toBe('text')
    expect(title?.paragraphs?.[0].runs[0]).toMatchObject({
      sizePt: 40,
      bold: true,
      color: '#0E7C7B',
      font: 'Lexend'
    })
    const body = first.shapes.find((s) => s.paragraphs?.[0].runs[0].text === 'Plants make food')
    expect(body?.paragraphs?.[0].runs[0]).toMatchObject({ sizePt: 20, color: '#12263A' })
  })

  it('maps EMU to the 1920x1080 grid and reads fills and geometry', async () => {
    const [first] = (await digestPptx(await deck())).slides
    const title = first.shapes.find((s) => s.name?.startsWith('Text'))
    // pptxgenjs default 16:9 is 10in x 5.625in: x 0.5in -> 96 units, w 9in -> 1728
    expect(title?.box).toMatchObject({ x: 96, w: 1728 })
    const box = first.shapes.find((s) => s.fill === '#FFE36E')
    expect(box).toMatchObject({ kind: 'shape', geometry: 'rect' })
    expect(box?.box?.x).toBe(1152)
    for (const shape of first.shapes) {
      expect(shape.box!.x + shape.box!.w).toBeLessThanOrEqual(1920)
      expect(shape.box!.y + shape.box!.h).toBeLessThanOrEqual(1080)
    }
  })

  it('counts colours, fonts and sizes across the deck', async () => {
    const { stats } = await digestPptx(await deck())
    expect(stats.colors[0]).toEqual({ value: '#0E7C7B', count: 3 })
    expect(stats.fonts).toEqual([{ value: 'Lexend', count: 5 }])
    expect(stats.sizesPt[0]).toEqual({ value: 40, count: 3 })
  })

  it('keeps slides in presentation order', async () => {
    const digest = await digestPptx(await deck())
    const titles = digest.slides.map((s) => s.shapes[0].paragraphs?.[0].runs[0].text)
    expect(titles).toEqual(['Photosynthesis', 'Key words', 'Plenary'])
  })

  it('reads pictures with their alt text and box', async () => {
    const pres = new (await import('pptxgenjs')).default()
    pres.addSlide().addImage({
      data: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      x: 1,
      y: 1,
      w: 2,
      h: 2,
      altText: 'a leaf'
    })
    const digest = await digestPptx((await pres.write({ outputType: 'nodebuffer' })) as Buffer)
    expect(digest.slides[0].shapes[0]).toMatchObject({
      kind: 'picture',
      name: 'a leaf',
      box: { w: 384, h: 384 }
    })
  })

  it('flags slides that look like they contain personal data', async () => {
    const pii = await makePptx([{ title: 'Contact', body: 'mrs.smith@school.org.uk' }])
    expect((await digestPptx(pii)).mayContainNames).toBe(true)
    expect((await digestPptx(await deck())).mayContainNames).toBe(false)
  })

  it('survives a missing theme with a warning', async () => {
    const bytes = await rebuild(await deck(), (zip) => void zip.remove('ppt/theme/theme1.xml'))
    const digest = await digestPptx(bytes)
    expect(digest.theme.colors).toEqual({})
    expect(digest.warnings).toContain('No theme found')
    expect(digest.slides).toHaveLength(3)
  })

  it('skips one broken slide but still counts it', async () => {
    const bytes = await rebuild(
      await deck(),
      (zip) => void zip.file('ppt/slides/slide2.xml', '<p:sld><unclosed')
    )
    const digest = await digestPptx(bytes)
    expect(digest.slideCount).toBe(3)
    expect(digest.slides).toHaveLength(2)
    expect(digest.warnings).toEqual(['Slide 2 could not be read'])
  })

  it('falls back to file order when the slide list or rels are missing', async () => {
    const bytes = await rebuild(
      await deck(),
      (zip) => void zip.remove('ppt/_rels/presentation.xml.rels')
    )
    expect((await digestPptx(bytes)).slideCount).toBe(3)
  })

  it('reports "No slides found" for a deck without slides', async () => {
    const bytes = await rebuild(await deck(), (zip) => {
      for (const name of Object.keys(zip.files))
        if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) zip.remove(name)
    })
    await expect(digestPptx(bytes)).rejects.toMatchObject({
      code: 'empty',
      message: 'No slides found'
    })
  })

  it('reports damaged files for non-zip bytes and zips that are not decks', async () => {
    await expect(digestPptx(Buffer.from('this is not a zip'))).rejects.toMatchObject({
      code: 'corrupt',
      message: 'This file is damaged'
    })
    const zip = new JSZip().file('hello.txt', 'hi')
    await expect(digestPptx(await zip.generateAsync({ type: 'uint8array' }))).rejects.toMatchObject(
      {
        code: 'corrupt'
      }
    )
  })

  it('reports "Password protected" for encrypted Office containers', async () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64)
    ])
    await expect(digestPptx(ole)).rejects.toMatchObject({
      code: 'password',
      message: 'Password protected'
    })
  })
})
