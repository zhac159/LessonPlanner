import { describe, expect, it } from 'vitest'
import type { PluginTint } from '@shared/contracts/deck-builder-plugins'
import { bandToneFor } from './tones'

describe('bandToneFor', () => {
  it('keeps tints the band already knows', () => {
    for (const tint of ['peach', 'sky', 'mint', 'butter'] as const) {
      expect(bandToneFor(tint)).toBe(tint)
    }
  })

  it("renames purple-soft to the band's purple", () => {
    expect(bandToneFor('purple-soft')).toBe('purple')
  })

  it('covers every tint', () => {
    const tints: PluginTint[] = ['peach', 'sky', 'mint', 'butter', 'purple-soft']
    expect(tints.map(bandToneFor)).toHaveLength(5)
  })
})
