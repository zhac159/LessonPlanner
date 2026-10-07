import { describe, expect, it } from 'vitest'
import { parseStyleProfile } from '@shared/style/schema'
import { outputFormat } from '../request'
import { sampleSlideWire, sampleStyleDraft, wireElement } from '../sampleDrafts'
import { strictViolations } from '../testing'
import {
  analysisWire,
  objectivesWire,
  patchWire,
  planWire,
  toFileAnalysis,
  toObjectives,
  toPlan
} from './lesson'
import { slideWire, toColour, toSlide } from './slide'
import { AVAILABLE_FONTS, draftToProfile, partialProfile, snapWeight } from './style'
import { styleCore, styleDraft, styleLayouts } from './styleDraft'

describe('wire schemas are valid for structured outputs', () => {
  it.each([
    ['slide', slideWire],
    ['style draft', styleDraft],
    ['style core', styleCore],
    ['style layouts', styleLayouts],
    ['analysis', analysisWire],
    ['objectives', objectivesWire],
    ['plan', planWire],
    ['patch', patchWire]
  ])('%s: every object closed and fully required, no open maps', (_name, schema) => {
    expect(strictViolations(outputFormat(schema).schema)).toEqual([])
  })
})

describe('toSlide', () => {
  it('assigns ids, strips "not set" values and marks the slide as AI-written', () => {
    const slide = toSlide(sampleSlideWire(), 'sld_1')
    expect(slide).toMatchObject({
      id: 'sld_1',
      kind: 'content',
      layoutId: 'content-text-left-image-right',
      source: { by: 'ai' }
    })
    expect(slide.elements.map((e) => e.id)).toEqual(['sld_1-e1', 'sld_1-e2'])
    const title = slide.elements[0]
    if (title.type !== 'text') throw new Error('expected text')
    expect(title.paragraphs[0].runs).toEqual([
      { text: 'Where does ' },
      { text: 'photosynthesis', bold: true, color: 'token:accent' }
    ])
    expect(title.paragraphs[0].list).toBeUndefined()
    expect(title.fontSizePt).toBeUndefined()
    expect(slide.elements[1]).toMatchObject({
      type: 'image',
      placeholder: { description: 'A leaf in sunlight' },
      alt: 'A leaf in sunlight'
    })
  })

  it('snaps boxes inside the 1920x1080 slide', () => {
    const wire = sampleSlideWire()
    wire.elements[0] = { ...wire.elements[0], x: 1900, y: -50, w: 900, h: 5000 }
    const [element] = toSlide(wire, 's').elements
    expect(element).toMatchObject({ x: 1900, y: 0, w: 20, h: 1080 })
  })

  it('drops invalid colours instead of passing garbage on', () => {
    expect(toColour('token:accent')).toBe('token:accent')
    expect(toColour('#0E9AA7')).toBe('#0E9AA7')
    expect(toColour('red')).toBeUndefined()
    expect(toColour('')).toBeUndefined()
    const wire = sampleSlideWire()
    wire.background = 'blue'
    expect(toSlide(wire, 's').background).toBeUndefined()
  })

  it('maps every element type', () => {
    const base = {
      name: '',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      locked: true,
      styleRef: 'decoration.leftBand'
    }
    const slide = toSlide(
      {
        kind: 'title',
        layoutId: '',
        background: '#FFFFFF',
        notes: '',
        elements: [
          wireElement({
            type: 'shape',
            ...base,
            shape: 'rect',
            fill: 'token:accent',
            strokeColor: '#000000',
            strokeWidth: 2,
            radius: 4
          }),
          wireElement({ type: 'chips', ...base, items: ['a', 'b'] }),
          wireElement({ type: 'callout', ...base, variant: 'warning', label: 'Careful' }),
          wireElement({
            type: 'diagram',
            ...base,
            svg: '<svg viewBox="0 0 1 1"/>',
            alt: 'diagram'
          }),
          wireElement({ type: 'table', ...base, rows: [['a']], headerRow: true })
        ]
      },
      's'
    )
    expect(slide.background).toEqual({ color: '#FFFFFF' })
    expect(slide.layoutId).toBeUndefined()
    expect(slide.notes).toBeUndefined()
    expect(slide.elements[0]).toMatchObject({
      locked: true,
      styleRef: 'decoration.leftBand',
      fill: { color: 'token:accent' },
      stroke: { color: '#000000', width: 2 },
      radius: 4
    })
    expect(slide.elements.map((e) => e.type)).toEqual([
      'shape',
      'chips',
      'callout',
      'diagram',
      'table'
    ])
  })
})

describe('lesson mappers', () => {
  const emptyAnalysis = {
    colors: [],
    fonts: [],
    layouts: [],
    decorations: [],
    slideKinds: [],
    voice: { rules: [], phrases: [], spelling: 'en-GB' as const },
    habits: [],
    exemplarCandidates: [],
    problems: []
  }

  it('toFileAnalysis removes zero/empty placeholders', () => {
    const analysis = toFileAnalysis({
      ...emptyAnalysis,
      fonts: [{ family: 'Lexend', usedFor: 'title', sizePt: 0, weight: 700 }],
      decorations: [
        { description: 'band', shape: 'rect', x: 0, y: 0, w: 27, h: 1080, color: '' },
        { description: 'vague swirl', shape: '', x: 0, y: 0, w: 0, h: 0, color: '#112233' }
      ],
      slideKinds: [{ page: 1, kind: 'title', title: '' }]
    })
    expect(analysis.fonts[0]).toEqual({ family: 'Lexend', usedFor: 'title', weight: 700 })
    expect(analysis.decorations).toEqual([
      { description: 'band', shape: 'rect', x: 0, y: 0, w: 27, h: 1080 },
      { description: 'vague swirl', color: '#112233' }
    ])
    expect(analysis.slideKinds).toEqual([{ page: 1, kind: 'title' }])
    expect(analysis.problems).toBeUndefined()
  })

  it('toFileAnalysis keeps problems when there are some', () => {
    expect(toFileAnalysis({ ...emptyAnalysis, problems: ['scanned'] }).problems).toEqual([
      'scanned'
    ])
  })

  it('toObjectives and toPlan drop empty optionals', () => {
    expect(
      toObjectives({ title: 'T', subject: '', yearGroup: 'Y8', objectives: ['a'], context: '' })
    ).toEqual({ title: 'T', yearGroup: 'Y8', objectives: ['a'] })
    const slide = { layoutId: 'l', purpose: 'p', keyContent: [], objectiveRefs: [] }
    const plan = toPlan({
      title: 'T',
      summary: 's',
      slides: [
        { ...slide, kind: 'title', minutes: 0 },
        { ...slide, kind: 'content', minutes: 10 }
      ]
    })
    expect(plan.slides[0].minutes).toBeUndefined()
    expect(plan.slides[1].minutes).toBe(10)
  })
})

describe('style draft', () => {
  const ctx = { name: 'Science KS3', now: '2026-10-06T10:00:00Z', newId: () => 'sty_new' }

  it('builds a profile that passes the shared schema', () => {
    const profile = draftToProfile(sampleStyleDraft(), ctx)
    expect(() => parseStyleProfile(profile)).not.toThrow()
    expect(profile).toMatchObject({
      id: 'sty_new',
      name: 'Science KS3',
      version: 1,
      status: 'ready',
      sources: [],
      createdAt: ctx.now
    })
    expect(profile.tokens.colors.accent.hex).toMatch(/^#[0-9A-F]{6}$/)
    expect(profile.tokens.fonts.accent).toBeUndefined()
    expect(profile.components.title.font).toBe('title')
  })

  it('updates an existing profile: keeps id, sources and corrections, bumps the version', () => {
    const first = draftToProfile(sampleStyleDraft(), ctx)
    const existing = {
      ...first,
      sources: [
        {
          id: 'src_1',
          fileName: 'a.pdf',
          kind: 'pdf' as const,
          pages: 3,
          status: 'learned' as const,
          addedAt: 'x'
        }
      ],
      corrections: [{ text: 'bigger', at: 'x', appliedInVersion: 1 }],
      isDefault: true
    }
    const next = draftToProfile(sampleStyleDraft(), {
      ...ctx,
      existing,
      now: '2026-10-07T10:00:00Z',
      newId: () => 'other'
    })
    expect(next).toMatchObject({
      id: first.id,
      version: 2,
      isDefault: true,
      createdAt: ctx.now,
      updatedAt: '2026-10-07T10:00:00Z'
    })
    expect(next.sources).toHaveLength(1)
    expect(next.corrections).toHaveLength(1)
  })

  it('skips colours with an unusable hex and marks bundled fonts available', () => {
    const draft = sampleStyleDraft()
    draft.colors.push({ token: 'bad', hex: 'teal', label: 'x', usage: 'x' })
    const profile = draftToProfile(draft, ctx)
    expect(profile.tokens.colors.bad).toBeUndefined()
    expect(profile.tokens.fonts.title.available).toBe(
      AVAILABLE_FONTS.includes(profile.tokens.fonts.title.family)
    )
  })

  it('snaps font weights to the allowed set', () => {
    expect(snapWeight(700)).toBe(700)
    expect(snapWeight(650)).toBe(600)
    expect(snapWeight(900)).toBe(800)
    expect(snapWeight(300)).toBe(400)
    expect(snapWeight(NaN)).toBe(400)
  })

  it('partialProfile reports only sections that are complete', () => {
    const draft = sampleStyleDraft()
    expect(partialProfile(undefined)).toEqual({})
    expect(partialProfile({ colors: draft.colors.slice(0, 1) })).toEqual({})
    const early = partialProfile({
      colors: draft.colors,
      fonts: draft.fonts,
      layouts: [draft.layouts[0], { id: 'half' }]
    })
    expect(Object.keys(early.tokens?.colors ?? {})).toHaveLength(draft.colors.length)
    expect(early.layouts).toHaveLength(1)
    expect(early.voice).toBeUndefined()
    const later = partialProfile(draft)
    expect(later.voice?.spelling).toBe('en-GB')
    expect(later.habits).toEqual(draft.habits)
  })
})
