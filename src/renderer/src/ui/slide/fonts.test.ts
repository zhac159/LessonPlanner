import { describe, expect, it, vi } from 'vitest'
import { fixtureStyle } from '@shared/deck/testing'
import { createFontLoader, type FontRegistry } from './fonts'

function fakeRegistry() {
  const lexend = vi.fn(async () => ({}))
  const poppins = vi.fn(async () => ({}))
  const registry: FontRegistry = {
    lexend: { cssFamily: 'Lexend Variable', load: lexend },
    poppins: { cssFamily: 'Poppins', load: poppins }
  }
  return { registry, lexend, poppins }
}

describe('font loader', () => {
  it('knows which families are bundled, ignoring case and spaces', () => {
    const loader = createFontLoader(fakeRegistry().registry)
    expect(loader.isBundled('Lexend')).toBe(true)
    expect(loader.isBundled('  POPPINS ')).toBe(true)
    expect(loader.isBundled('Comic Sans')).toBe(false)
  })

  it('puts the bundled face before the profile fallback stack', () => {
    const loader = createFontLoader(fakeRegistry().registry)
    const { title } = fixtureStyle().tokens.fonts
    expect(loader.fontFamilyCss(title)).toBe(`'Lexend Variable', ${title.fallbackStack}`)
  })

  it('uses only the fallback stack for fonts that are not bundled', () => {
    const loader = createFontLoader(fakeRegistry().registry)
    const font = {
      ...fixtureStyle().tokens.fonts.body,
      family: 'Calibri',
      fallbackStack: "'Calibri', Arial, sans-serif"
    }
    expect(loader.fontFamilyCss(font)).toBe("'Calibri', Arial, sans-serif")
  })

  it('loads each font a profile uses once, however often it is asked', async () => {
    const { registry, lexend, poppins } = fakeRegistry()
    const loader = createFontLoader(registry)
    const style = fixtureStyle() // title and body are both Lexend
    await Promise.all([loader.load(style), loader.load(style)])
    await loader.load(style)
    expect(lexend).toHaveBeenCalledTimes(1)
    expect(poppins).not.toHaveBeenCalled()
  })

  it('loads the accent font too', async () => {
    const { registry, poppins } = fakeRegistry()
    const style = fixtureStyle()
    style.tokens.fonts.accent = { ...style.tokens.fonts.body, family: 'Poppins' }
    await createFontLoader(registry).load(style)
    expect(poppins).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a profile or for unknown fonts', async () => {
    const { registry, lexend } = fakeRegistry()
    const loader = createFontLoader(registry)
    await loader.load(null)
    const style = fixtureStyle()
    style.tokens.fonts.title.family = 'Unknown'
    style.tokens.fonts.body.family = 'Unknown'
    await loader.load(style)
    expect(lexend).not.toHaveBeenCalled()
  })

  it('survives a failed load and retries next time', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({})
    const loader = createFontLoader({ lexend: { cssFamily: 'Lexend Variable', load } })
    await expect(loader.load(fixtureStyle())).resolves.toBeUndefined()
    await loader.load(fixtureStyle())
    expect(load).toHaveBeenCalledTimes(2)
  })
})
