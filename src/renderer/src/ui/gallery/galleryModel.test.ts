import { describe, expect, it } from 'vitest'
import { collectGalleries, slugify } from './galleryModel'

const group = (title: string) => ({ title, sections: [{ name: 'A', render: () => null }] })

describe('collectGalleries', () => {
  it('sorts valid groups by title', () => {
    const { groups } = collectGalleries({
      '../b/gallery.tsx': group('Overlays'),
      '../a/gallery.tsx': group('Atoms'),
      '../c/gallery.tsx': group('Chrome')
    })
    expect(groups.map((g) => g.title)).toEqual(['Atoms', 'Chrome', 'Overlays'])
  })

  it('skips malformed exports and reports where they came from', () => {
    const { groups, skipped } = collectGalleries({
      '../ok/gallery.tsx': group('Atoms'),
      '../nothing/gallery.tsx': undefined,
      '../string/gallery.tsx': 'oops',
      '../no-title/gallery.tsx': { sections: [] },
      '../bad-section/gallery.tsx': { title: 'X', sections: [{ name: 'A' }] },
      '../bad-sections/gallery.tsx': { title: 'X', sections: 'nope' }
    })
    expect(groups).toHaveLength(1)
    expect(skipped).toEqual([
      '../bad-section/gallery.tsx',
      '../bad-sections/gallery.tsx',
      '../no-title/gallery.tsx',
      '../nothing/gallery.tsx',
      '../string/gallery.tsx'
    ])
  })

  it('accepts a group with no sections', () => {
    expect(collectGalleries({ x: { title: 'Empty', sections: [] } }).groups).toHaveLength(1)
  })

  it('handles no galleries at all', () => {
    expect(collectGalleries({})).toEqual({ groups: [], skipped: [] })
  })
})

describe('slugify', () => {
  it('makes URL-safe ids', () => {
    expect(slugify('Form fields')).toBe('form-fields')
    expect(slugify('  Chat & messages! ')).toBe('chat-messages')
  })
  it('never returns an empty id', () => {
    expect(slugify('???')).toBe('group')
  })
})
