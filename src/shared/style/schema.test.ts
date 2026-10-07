import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDraftProfile } from './draft'
import { parseStyleProfile, safeParseStyleProfile } from './schema'

const fixture = (): unknown =>
  JSON.parse(readFileSync(resolve('design/fixtures/style-profile.science-ks3.json'), 'utf8'))

type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const draft = (): Loose => createDraftProfile('sty_1', 'x', 'now') as unknown as Loose

describe('parseStyleProfile', () => {
  it('accepts the Science KS3 design fixture', () => {
    const profile = parseStyleProfile(fixture())
    expect(profile.name).toBe('Science KS3')
    expect(profile.tokens.colors.accent.hex).toBe('#0E7C7B')
  })

  it('accepts a fresh draft profile', () => {
    expect(() => parseStyleProfile(draft())).not.toThrow()
  })

  it('rejects bad hex colours, unknown slide kinds, wrong schema versions and odd font weights', () => {
    const bad = (mutate: (p: Loose) => void) => {
      const p = draft()
      mutate(p)
      return safeParseStyleProfile(p).ok
    }
    expect(bad((p) => (p.tokens.colors.text.hex = 'navy'))).toBe(false)
    expect(bad((p) => (p.lessonFlow = ['nonsense']))).toBe(false)
    expect(bad((p) => (p.schemaVersion = 2))).toBe(false)
    expect(bad((p) => (p.tokens.fonts.title.weight = 450))).toBe(false)
  })

  it('throws on non-objects', () => {
    expect(() => parseStyleProfile(null)).toThrow()
    expect(() => parseStyleProfile('x')).toThrow()
  })
})

describe('safeParseStyleProfile', () => {
  it('reports the path of the first problem', () => {
    const p = draft()
    delete p.voice
    const result = safeParseStyleProfile(p)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('voice')
  })

  it('returns the typed profile on success', () => {
    const result = safeParseStyleProfile(fixture())
    expect(result.ok && result.profile.layouts.length).toBeGreaterThan(0)
  })

  it('keeps picture habits and fonts needed, and still accepts a profile without them', () => {
    const p = draft()
    expect(parseStyleProfile(p).pictures).toBeUndefined()
    p.pictures = {
      lines: ['A picture on the right'],
      slideKinds: [
        { kind: 'content', pictures: 'usually', typicalBox: { x: 1, y: 2, w: 3, h: 4 } }
      ],
      placements: [
        {
          assetId: 'ast_1',
          slideKind: 'every',
          anchor: 'top-right',
          widthUnits: 220,
          marginUnits: 32,
          decks: 2
        }
      ]
    }
    p.fontsNeeded = ['Comic Sans MS']
    const parsed = parseStyleProfile(p)
    expect(parsed.pictures?.placements[0].anchor).toBe('top-right')
    expect(parsed.fontsNeeded).toEqual(['Comic Sans MS'])
    p.pictures.placements[0].anchor = 'middle'
    expect(safeParseStyleProfile(p).ok).toBe(false)
  })
})
