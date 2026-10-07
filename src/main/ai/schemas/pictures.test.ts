import { describe, expect, it } from 'vitest'
import { outputFormat } from '../request'
import { strictViolations } from '../testing'
import {
  cleanFacts,
  cleanStyle,
  describeWire,
  describedFrom,
  kindFromHint,
  olderOf,
  styleWire,
  svgWire
} from './pictures'

describe('picture wire schemas are valid for structured outputs', () => {
  it.each([
    ['describe', describeWire],
    ['style', styleWire],
    ['svg', svgWire]
  ])('%s: every object closed and fully required, no open maps', (_name, schema) => {
    expect(strictViolations(outputFormat(schema).schema)).toEqual([])
  })

  it('describe stays flat: one array of one-level objects (grammar size)', () => {
    const json = JSON.stringify(outputFormat(describeWire).schema)
    expect(json.match(/"type":"object"/g)).toHaveLength(2)
    expect(json.length).toBeLessThan(2500)
  })
})

describe('cleanFacts', () => {
  const base = {
    index: 1,
    title: '  School   logo ',
    name: 'school_logo',
    kind: 'logo' as const,
    description: 'x'.repeat(500),
    tags: ['Blue', ' blue ', '', 'a', 'b', 'c', 'd', 'e'],
    maybePupils: true,
    blurry: false,
    olderVersionOf: -1
  }

  it('trims the title, cuts a long description, lower-cases and de-duplicates up to five tags', () => {
    const facts = cleanFacts(base, 'logo')
    expect(facts.title).toBe('School logo')
    expect(facts.description.length).toBeLessThanOrEqual(400)
    expect(facts.tags).toEqual(['blue', 'a', 'b', 'c', 'd'])
    expect(facts.maybePupils).toBe(true)
  })

  it('falls back to the extractor’s hint when the kind is not one of ours', () => {
    expect(cleanFacts({ ...base, kind: 'cartoon' as never }, 'other').kind).toBe('picture')
    expect(cleanFacts({ ...base, kind: 'cartoon' as never }, 'symbol-card').kind).toBe(
      'symbol-card'
    )
    expect(kindFromHint('photo')).toBe('photo')
  })
})

describe('describedFrom and olderOf', () => {
  const facts = cleanFacts(
    {
      index: 1,
      title: 'Leaf',
      name: 'leaf',
      kind: 'photo',
      description: 'A leaf.',
      tags: [],
      maybePupils: false,
      blurry: false,
      olderVersionOf: -1
    },
    'photo'
  )

  it('makes each name unique against the set, which grows', () => {
    const used = new Set(['leaf'])
    expect(describedFrom(1, facts, null, used).name).toBe('leaf_2')
    expect(describedFrom(2, facts, 1, used)).toMatchObject({ name: 'leaf_3', olderVersionOf: 1 })
  })

  it('accepts only another picture of the same batch', () => {
    const batch = new Set([1, 2, 3])
    expect(olderOf(2, 1, batch)).toBe(2)
    expect(olderOf(1, 1, batch)).toBeNull()
    expect(olderOf(-1, 1, batch)).toBeNull()
    expect(olderOf(9, 1, batch)).toBeNull()
    expect(olderOf(1.5, 1, batch)).toBeNull()
  })
})

describe('cleanStyle', () => {
  it('removes markdown and extra spaces, and keeps at most 90 words', () => {
    expect(cleanStyle('## Look\n**Flat**  shapes (#0E9AA7) with `navy` lines')).toBe(
      'Look Flat shapes (#0E9AA7) with navy lines'
    )
    const long = cleanStyle(Array.from({ length: 120 }, (_, i) => `w${i}`).join(' '))
    expect(long.split(' ')).toHaveLength(90)
    expect(long.endsWith('…')).toBe(true)
  })
})
