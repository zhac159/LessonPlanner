import { describe, expect, it } from 'vitest'
import {
  costLine,
  decksLabel,
  foundSummary,
  keepLabel,
  foundInText,
  leftOutLabel,
  replaceLabel,
  spotsLabel,
  truncate
} from './format'

const deck = (fileName: string, page: number | null) => ({
  styleId: null,
  sourceId: 's',
  fileName,
  page
})

describe('leftOutLabel', () => {
  it('uses the exact reason pills of A2', () => {
    expect(leftOutLabel('pupils')).toBe('May show pupils · left out')
    expect(leftOutLabel('blurry')).toBe('Blurry · left out')
    expect(leftOutLabel('older-version', 'school_logo')).toBe('Older version of school_logo')
    expect(leftOutLabel('older-version')).toBe('Older version · left out')
    expect(leftOutLabel('low-resolution')).toBe('Small picture · left out')
    expect(leftOutLabel('background')).toBe('Looks like a slide background · left out')
    expect(leftOutLabel('unreadable')).toBe("Can't read this picture · left out")
    expect(leftOutLabel('duplicate')).toBe('Already in Your assets')
  })
})

describe('foundInText', () => {
  it('names the first deck, its slide and the others', () => {
    const many = [
      deck('Y8 Photosynthesis.pptx', 1),
      ...Array.from({ length: 23 }, () => deck('x', 2))
    ]
    expect(foundInText(many, 'extracted')).toBe(
      'Found in Y8 Photosynthesis.pptx, slide 1 and 23 other decks'
    )
  })
  it('handles one deck, one other deck and no page', () => {
    expect(foundInText([deck('A.pptx', 4)], 'extracted')).toBe('Found in A.pptx, slide 4')
    expect(foundInText([deck('A.pdf', null), deck('B', 1)], 'extracted')).toBe(
      'Found in A.pdf and 1 other deck'
    )
  })
  it('says where pictures that were not found in a deck came from', () => {
    expect(foundInText([], 'uploaded')).toBe('Added by you')
    expect(foundInText([], 'online')).toBe('Picked online')
    expect(foundInText([], 'generated')).toBe('Made with Claude')
  })
})

describe('small wording helpers', () => {
  it('prices a job in cents or dollars', () => {
    expect(costLine(0.134, 4)).toBe('About 54 cents · Google bills this')
    expect(costLine(0.3, 4)).toBe('About $1.20 · Google bills this')
  })
  it('cuts text with an ellipsis', () => {
    expect(truncate('Photo: leaf in sunlight', 28)).toBe('Photo: leaf in sunlight')
    expect(
      truncate('A very long description of a leaf in sunlight', 28).length
    ).toBeLessThanOrEqual(28)
    expect(truncate('A very long description of a leaf in sunlight', 28).endsWith('…')).toBe(true)
  })
  it('words the replace checkbox', () => {
    expect(replaceLabel('Photo: leaf in sunlight')).toBe(
      'Replace what’s underneath (Photo: leaf in sunlight)'
    )
    expect(replaceLabel()).toBe('Replace what’s underneath')
  })
  it('counts decks and spots', () => {
    expect(decksLabel(24)).toBe('In 24 decks')
    expect(decksLabel(1)).toBe('In 1 deck')
    expect(spotsLabel(3)).toBe('3 picture spots to fill')
    expect(spotsLabel(1)).toBe('1 picture spot to fill')
  })
})

describe('review labels', () => {
  it('words the Keep button', () => {
    expect(keepLabel(9)).toBe('Keep 9 assets')
    expect(keepLabel(1)).toBe('Keep 1 asset')
    expect(keepLabel(0)).toBe('Nothing to keep')
  })
  it('summarises what was found', () => {
    expect(foundSummary(12, 9)).toBe('Found 12 · keeping 9')
  })
})
