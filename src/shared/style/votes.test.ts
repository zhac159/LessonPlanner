import { describe, expect, it } from 'vitest'
import { makeAnalysis } from './testing'
import { aggregateAnalyses, normaliseHex } from './votes'

describe('normaliseHex', () => {
  it('upper-cases, expands short form and adds #', () => {
    expect(normaliseHex('#abc')).toBe('#AABBCC')
    expect(normaliseHex('0e7c7b')).toBe('#0E7C7B')
    expect(normaliseHex(' #FFFFFF ')).toBe('#FFFFFF')
  })
  it('rejects junk', () => {
    expect(normaliseHex('navy')).toBeNull()
    expect(normaliseHex('#12345')).toBeNull()
    expect(normaliseHex('')).toBeNull()
  })
})

describe('aggregateAnalyses', () => {
  it('handles no analyses', () => {
    const learned = aggregateAnalyses([])
    expect(learned).toMatchObject({ files: 0, colours: [], fonts: [], palette: {}, spelling: null })
  })

  it('votes colours by weighted frequency and picks the winner per role', () => {
    const a = makeAnalysis({
      colors: [
        { hex: '#0E7C7B', role: 'accent', evidence: '', frequency: 'many' },
        { hex: '#FF0000', role: 'accent', evidence: '', frequency: 'some' }
      ]
    })
    const b = makeAnalysis({
      colors: [
        { hex: '#0e7c7b', role: 'accent', evidence: '', frequency: 'some' },
        { hex: '#FF0000', role: 'accent', evidence: '', frequency: 'some' }
      ]
    })
    const learned = aggregateAnalyses([a, b])
    expect(learned.palette.accent).toBe('#0E7C7B')
    expect(learned.colours[0]).toEqual({ hex: '#0E7C7B', role: 'accent', votes: 3, files: 2 })
    expect(learned.colours[1].votes).toBe(2)
  })

  it('ignores invalid hex values and never puts "other" in the palette', () => {
    const learned = aggregateAnalyses([
      makeAnalysis({
        colors: [
          { hex: 'blue', role: 'accent', evidence: '', frequency: 'most' },
          { hex: '#123456', role: 'other', evidence: '', frequency: 'most' }
        ]
      })
    ])
    expect(learned.colours).toHaveLength(1)
    expect(learned.palette).toEqual({})
  })

  it('merges fonts case-insensitively per use, with, weight and size range', () => {
    const learned = aggregateAnalyses([
      makeAnalysis({ fonts: [{ family: 'Lexend', usedFor: 'title', sizePt: 40, weight: 700 }] }),
      makeAnalysis({
        fonts: [
          { family: 'lexend', usedFor: 'title', sizePt: 44, weight: 700 },
          { family: 'Arial', usedFor: 'body' }
        ]
      })
    ])
    expect(learned.fonts[0]).toEqual({
      family: 'Lexend',
      use: 'title',
      files: 2,
      weight: 700,
      sizeRangePt: [40, 44]
    })
    expect(learned.fonts[1]).toMatchObject({
      family: 'Arial',
      files: 1,
      weight: null,
      sizeRangePt: null
    })
  })

  it('counts layouts once per file and sums pages', () => {
    const other = makeAnalysis({
      layouts: [{ name: ' text left, picture right ', description: '', regions: [], pages: [5] }]
    })
    const learned = aggregateAnalyses([makeAnalysis(), other])
    expect(learned.layouts).toHaveLength(1)
    expect(learned.layouts[0]).toMatchObject({ files: 2, pages: 3 })
  })

  it('derives slide kind frequency and her usual order', () => {
    const withQuiz = makeAnalysis({
      slideKinds: [
        { page: 1, kind: 'title' },
        { page: 2, kind: 'content' },
        { page: 3, kind: 'content' },
        { page: 4, kind: 'quiz' }
      ]
    })
    const learned = aggregateAnalyses([makeAnalysis(), makeAnalysis(), withQuiz])
    const byKind = Object.fromEntries(learned.slideKinds.map((k) => [k.kind, k]))
    expect(byKind.title.frequency).toBe('always')
    expect(byKind.quiz.frequency).toBe('sometimes')
    expect(byKind.content.frequency).toBe('always')
    expect(byKind.content.slides).toBe(4)
    expect(learned.lessonFlow[0]).toBe('title')
    expect(learned.lessonFlow.indexOf('content')).toBeLessThan(learned.lessonFlow.indexOf('quiz'))
  })

  it('ranks habits and voice rules by how many files mention them, ignoring case and punctuation', () => {
    const learned = aggregateAnalyses([
      makeAnalysis({
        habits: ['Rare habit', 'Teal band on every slide.'],
        voice: { rules: ['No full stops'], phrases: [], spelling: 'en-GB' }
      }),
      makeAnalysis({
        habits: ['teal band on every slide'],
        voice: { rules: ['no full stops!', 'No full stops'], phrases: ['Go'], spelling: 'unknown' }
      })
    ])
    expect(learned.habits[0]).toEqual({ text: 'Teal band on every slide.', files: 2 })
    expect(learned.habits[1]).toEqual({ text: 'Rare habit', files: 1 })
    expect(learned.voiceRules).toEqual([{ text: 'No full stops', files: 2 }])
    expect(learned.phrases).toEqual([{ text: 'Go', files: 1 }])
    expect(learned.spelling).toBe('en-GB')
  })

  it('does not depend on input order', () => {
    const a = makeAnalysis()
    const b = makeAnalysis({
      colors: [{ hex: '#111111', role: 'accent', evidence: '', frequency: 'some' }]
    })
    expect(aggregateAnalyses([a, b]).palette).toEqual(aggregateAnalyses([b, a]).palette)
    expect(aggregateAnalyses([a, b]).colours).toEqual(aggregateAnalyses([b, a]).colours)
  })
})
