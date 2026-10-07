import { describe, expect, it } from 'vitest'
import { fixtureStyle } from '@shared/deck/testing'
import { BUNDLED_FONTS, slideFonts } from './bundledFonts'

describe('bundled slide fonts', () => {
  it('ships the education fonts the design lists', () => {
    for (const name of ['lexend', 'open sans', 'poppins', 'nunito']) {
      expect(BUNDLED_FONTS).toHaveProperty(name)
      expect(slideFonts.isBundled(name)).toBe(true)
    }
  })

  it('names the @fontsource faces, so the CSS family matches the stylesheet', () => {
    const { title } = fixtureStyle().tokens.fonts
    expect(slideFonts.fontFamilyCss(title)).toBe(`'Lexend Variable', ${title.fallbackStack}`)
  })

  it('loads every bundled font without errors', async () => {
    for (const [family, font] of Object.entries(BUNDLED_FONTS)) {
      await expect(font.load(), family).resolves.not.toThrow()
    }
  })
})
