import { describe, expect, it } from 'vitest'
import { createDraftProfile } from '@shared/style/draft'
import { markFonts } from './fonts'

const profile = () => {
  const p = createDraftProfile('sty_1', 'Stonebridge English', '2026-10-07T00:00:00Z')
  p.tokens.fonts.title = { ...p.tokens.fonts.title, family: 'Comic Sans MS', available: false }
  p.tokens.fonts.body = { ...p.tokens.fonts.body, family: 'Arial', available: false }
  return p
}

describe('markFonts', () => {
  it('counts a font installed on this PC as available and lists it as needed elsewhere', async () => {
    const marked = await markFonts(profile(), async () => new Set(['comic sans ms', 'arial']))
    expect(marked.tokens.fonts.title.available).toBe(true)
    expect(marked.tokens.fonts.body.available).toBe(true)
    expect(marked.fontsNeeded).toEqual(['Comic Sans MS']) // Arial ships with Windows and the app
  })

  it('recognises a style of an installed family ("Comic Sans MS Bold")', async () => {
    const marked = await markFonts(profile(), async () => new Set(['comic sans ms bold']))
    expect(marked.tokens.fonts.title.available).toBe(true)
  })

  it('a font that is not installed stays unavailable; bundled fonts never need the registry', async () => {
    const marked = await markFonts(profile(), async () => undefined)
    expect(marked.tokens.fonts.title.available).toBe(false)
    expect(marked.tokens.fonts.body.available).toBe(true)
  })

  it('survives a registry that cannot be read, and drops a stale fontsNeeded', async () => {
    const stale = { ...profile(), fontsNeeded: ['Papyrus'] }
    const marked = await markFonts(stale, async () => Promise.reject(new Error('no registry')))
    expect(marked.tokens.fonts.title.available).toBe(false)
    expect(marked.fontsNeeded).toEqual(['Comic Sans MS'])
    const bundled = { ...createDraftProfile('sty_2', 'x', 'now'), fontsNeeded: ['Papyrus'] }
    expect((await markFonts(bundled, async () => undefined)).fontsNeeded).toBeUndefined()
  })
})
