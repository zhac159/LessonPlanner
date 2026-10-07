import { describe, expect, it } from 'vitest'
import type { Exemplar } from '@shared/style/types'
import { makeAnalysis } from '@shared/style/testing'
import { makePdf, makePptx } from '../../import/testing'
import {
  blocksFromDigest,
  buildFileExemplars,
  chooseExemplars,
  slideFromBlocks,
  type PagePicture
} from './exemplars'
import { readPdfPageText, type PageBlock } from './exemplarsPdf'

const block = (over: Partial<PageBlock> & { lines: string[] }): PageBlock => ({
  x: 100,
  y: 300,
  w: 800,
  h: 60,
  sizePt: 24,
  bold: false,
  ...over
})

describe('slideFromBlocks', () => {
  it('turns blocks into text elements, gives the top "Word:" its kicker role and keeps her pictures by name', () => {
    const pictures: PagePicture[] = [
      { page: 5, box: { x: 1100, y: 300, w: 600, h: 450 }, name: 'cave_photo', alt: 'a cave' }
    ]
    const slide = slideFromBlocks(
      'src_1-p5',
      'question',
      [
        block({ lines: ['Input:'], y: 40, sizePt: 24 }),
        block({ lines: ['What do you think these illustrations are?'], y: 300, sizePt: 32 })
      ],
      pictures
    )
    expect(slide.kind).toBe('question')
    expect(slide.elements.map((e) => e.type === 'text' && e.role)).toEqual([
      'kicker',
      'heading',
      false
    ])
    expect(slide.elements[2]).toMatchObject({ type: 'image', name: 'cave_photo', alt: 'a cave' })
  })

  it('never keeps a date: dates are cut out and a block that was only a date disappears', () => {
    const slide = slideFromBlocks(
      's-p2',
      'objectives',
      [
        block({ lines: ['Monday 5th October 2026'] }),
        block({ lines: ['Input: Monday 5th October 2026', 'LO: To infer meaning'] })
      ],
      []
    )
    expect(slide.elements).toHaveLength(1)
    expect(JSON.stringify(slide)).not.toMatch(/October|Monday/)
    expect(JSON.stringify(slide)).toContain('Input:')
  })
})

describe('blocksFromDigest', () => {
  it('reads the text shapes of a pptx slide in reading order and skips pictures and shapes without a box', () => {
    const blocks = blocksFromDigest({
      index: 2,
      shapes: [
        {
          kind: 'text',
          box: { x: 80, y: 500, w: 900, h: 100 },
          paragraphs: [{ runs: [{ text: 'Second', sizePt: 20, bold: true }] }]
        },
        {
          kind: 'text',
          box: { x: 80, y: 60, w: 900, h: 100 },
          paragraphs: [{ runs: [{ text: 'First', sizePt: 40 }] }]
        },
        { kind: 'picture', box: { x: 0, y: 0, w: 10, h: 10 } },
        { kind: 'text', paragraphs: [{ runs: [{ text: 'inherits its place' }] }] }
      ]
    })
    expect(blocks.map((b) => b.lines[0])).toEqual(['First', 'Second'])
    expect(blocks[0]).toMatchObject({ sizePt: 40, bold: false })
    expect(blocks[1]?.bold).toBe(true)
  })
})

describe('buildFileExemplars', () => {
  it('reads the named pages of a real PDF, with the kind of each page', async () => {
    const bytes = new Uint8Array(makePdf(['Input: cave picture', 'Task: sentence stems']))
    const analysis = makeAnalysis({
      slideKinds: [
        { page: 1, kind: 'question' },
        { page: 2, kind: 'activity' }
      ],
      exemplarCandidates: [
        { page: 2, why: 'Her task slide' },
        { page: 9, why: 'beyond the end' }
      ]
    })
    const exemplars = await buildFileExemplars({
      sourceId: 'src_1',
      kind: 'pdf',
      bytes,
      analysis,
      pictures: []
    })
    expect(exemplars).toHaveLength(1)
    expect(exemplars[0]).toMatchObject({
      sourceId: 'src_1',
      page: 2,
      kind: 'activity',
      why: 'Her task slide'
    })
    expect(JSON.stringify(exemplars[0].digest)).toContain('Task: sentence stems')
  })

  it('reads a pptx too, and a file with no candidates gives none', async () => {
    const bytes = new Uint8Array(await makePptx([{ title: 'Objectives slide' }]))
    const analysis = makeAnalysis({
      slideKinds: [{ page: 1, kind: 'objectives' }],
      exemplarCandidates: [{ page: 1, why: 'Her objectives' }]
    })
    const [one] = await buildFileExemplars({
      sourceId: 's',
      kind: 'pptx',
      bytes,
      analysis,
      pictures: []
    })
    expect(one.kind).toBe('objectives')
    expect(JSON.stringify(one.digest)).toContain('Objectives slide')
    const none = await buildFileExemplars({
      sourceId: 's',
      kind: 'pptx',
      bytes,
      analysis: makeAnalysis({ exemplarCandidates: [] }),
      pictures: []
    })
    expect(none).toEqual([])
  })
})

describe('readPdfPageText', () => {
  it('returns blocks on the 1920 x 1080 grid and ignores pages that do not exist', async () => {
    const pages = await readPdfPageText(new Uint8Array(makePdf(['Hello there'])), [1, 4])
    expect([...pages.keys()]).toEqual([1])
    const [first] = pages.get(1)!
    expect(first.lines).toEqual(['Hello there'])
    expect(first.x + first.w).toBeLessThanOrEqual(1920)
    expect(first.y + first.h).toBeLessThanOrEqual(1080)
  })
})

describe('chooseExemplars', () => {
  const ex = (sourceId: string, page: number, kind: Exemplar['kind']): Exemplar => ({
    sourceId,
    page,
    kind,
    why: '',
    digest: { id: `${sourceId}${page}`, kind, elements: [] }
  })

  it('takes a new slide kind before a repeat (b2 repeats objectives) and at most two for the style', () => {
    const a = [ex('a', 2, 'objectives'), ex('a', 3, 'do-now'), ex('a', 5, 'question')]
    const b = [ex('b', 2, 'objectives'), ex('b', 7, 'activity')]
    expect(chooseExemplars([a, b]).map((e) => `${e.sourceId}${e.page}`)).toEqual(['a2', 'a3'])
  })

  it('falls back to repeated kinds when there is nothing else, and copes with no files', () => {
    expect(chooseExemplars([[ex('a', 2, 'objectives')], [ex('b', 2, 'objectives')]])).toHaveLength(
      2
    )
    expect(chooseExemplars([])).toEqual([])
  })
})
