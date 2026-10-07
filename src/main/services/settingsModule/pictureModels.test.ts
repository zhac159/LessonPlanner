import { describe, expect, it } from 'vitest'
import { PICTURE_PRICES_USD } from '../imageProviders/nanoBanana'
import {
  PICTURE_MODEL_OPTIONS,
  isPictureModel,
  priceNote
} from '@modules/settings/ui/pictureModels'

describe('picture maker choices', () => {
  it('know every model and a 2K price that matches the one table in main', () => {
    for (const option of PICTURE_MODEL_OPTIONS) {
      const listed = PICTURE_PRICES_USD[option.value]
      expect(listed, option.value).toBeDefined()
      expect(option.priceUsd).toBe(Math.round(listed['2K'] * 100) / 100)
    }
  })

  it('offers Pro first (the default) and the cheaper one second', () => {
    expect(PICTURE_MODEL_OPTIONS.map((o) => o.value)).toEqual([
      'gemini-3-pro-image',
      'gemini-nano-banana-2.1'
    ])
  })

  it('words the price as "about" and recognises only its own ids', () => {
    expect(priceNote('gemini-3-pro-image')).toBe('About $0.13 a picture')
    expect(priceNote('gemini-nano-banana-2.1')).toBe('About $0.05 a picture')
    expect(isPictureModel('gemini-3-pro-image')).toBe(true)
    expect(isPictureModel('gpt-image')).toBe(false)
  })
})
