import { describe, expect, it } from 'vitest'
import { MAX_TAGS, MAX_TAG_LENGTH, addTag, normaliseTag, removeTag } from './tags'

describe('normaliseTag', () => {
  it('lower-cases, trims and drops commas', () => {
    expect(normaliseTag('  Title Slides, ')).toBe('title slides')
    expect(normaliseTag('a,b')).toBe('a b')
  })
  it('cuts at 24 characters', () => {
    expect(normaliseTag('x'.repeat(40))).toHaveLength(MAX_TAG_LENGTH)
  })
  it('gives an empty string for blanks', () => {
    expect(normaliseTag(' , ')).toBe('')
  })
})

describe('addTag', () => {
  it('adds a new tag at the end', () => {
    expect(addTag(['logo'], 'Title Slides')).toEqual(['logo', 'title slides'])
  })
  it('ignores empty, duplicate (after normalising) and over-limit tags', () => {
    const tags = ['logo']
    expect(addTag(tags, '  ')).toBe(tags)
    expect(addTag(tags, 'LOGO')).toBe(tags)
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(addTag(full, 'one more')).toBe(full)
  })
})

describe('removeTag', () => {
  it('removes just that tag', () => {
    expect(removeTag(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
})
