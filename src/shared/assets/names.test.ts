import { describe, expect, it } from 'vitest'
import {
  ASSET_NAME_MAX,
  ASSET_NAME_RE,
  checkAssetName,
  isReservedAssetName,
  slugifyAssetName,
  suggestAssetName,
  uniqueAssetName
} from './names'

describe('slugifyAssetName', () => {
  it('lower-cases, joins words with one underscore and drops accents', () => {
    expect(slugifyAssetName('School logo')).toBe('school_logo')
    expect(slugifyAssetName('  {{Do Now banner}}  ')).toBe('do_now_banner')
    expect(slugifyAssetName('Café – menu!')).toBe('cafe_menu')
    expect(slugifyAssetName('5-minute timer')).toBe('5_minute_timer')
    expect(slugifyAssetName('Cells & organelles')).toBe('cells_and_organelles')
  })

  it('returns an empty string when nothing usable is left', () => {
    expect(slugifyAssetName('!!!')).toBe('')
    expect(slugifyAssetName('')).toBe('')
  })

  it('cuts at a word boundary when a limit is given', () => {
    expect(slugifyAssetName('leaf_cross_section_labelled_diagram', 28)).toBe(
      'leaf_cross_section_labelled'
    )
    expect(slugifyAssetName('a'.repeat(40), 32)).toHaveLength(32)
  })
})

describe('checkAssetName', () => {
  const taken = ['school_logo', 'Beaker_Icon']

  it('accepts and normalises a good name', () => {
    expect(checkAssetName('Bunsen burner icon', taken)).toEqual({
      ok: true,
      name: 'bunsen_burner_icon'
    })
    expect(ASSET_NAME_RE.test('timer_icon')).toBe(true)
    expect(ASSET_NAME_RE.test('_timer')).toBe(false)
    expect(ASSET_NAME_RE.test('timer__icon')).toBe(false)
  })

  it('refuses too short, too long and letterless names with the exact copy', () => {
    expect(checkAssetName('a', taken)).toMatchObject({
      ok: false,
      problem: 'too-short',
      message: 'Use at least 2 characters.'
    })
    expect(checkAssetName('x'.repeat(ASSET_NAME_MAX + 1), taken)).toMatchObject({
      ok: false,
      problem: 'too-long',
      message: 'Use 32 characters or fewer.'
    })
    expect(checkAssetName('2024', taken)).toMatchObject({ ok: false, problem: 'invalid' })
    expect(checkAssetName('!!!', taken)).toMatchObject({ ok: false, problem: 'too-short' })
  })

  it('refuses reserved words and patterns', () => {
    expect(checkAssetName('slide', [])).toMatchObject({ ok: false, problem: 'reserved' })
    expect(checkAssetName('Region 3', [])).toMatchObject({ ok: false, problem: 'reserved' })
    expect(checkAssetName('slide_12', [])).toMatchObject({ ok: false, problem: 'reserved' })
    expect(isReservedAssetName('slide_show')).toBe(false)
    const reserved = checkAssetName('spot', [])
    expect(!reserved.ok && reserved.message).toBe('“spot” is kept for the app. Try another name.')
  })

  it('refuses a name another asset has (ignoring case), but not the asset’s own name', () => {
    expect(checkAssetName('School Logo', taken)).toMatchObject({
      ok: false,
      problem: 'taken',
      message: 'You already have an asset called school_logo.'
    })
    expect(checkAssetName('beaker icon', taken)).toMatchObject({ ok: false, problem: 'taken' })
    expect(checkAssetName('school_logo', taken, 'school_logo')).toEqual({
      ok: true,
      name: 'school_logo'
    })
  })
})

describe('uniqueAssetName and suggestAssetName', () => {
  it('returns the base when free and numbers it when taken', () => {
    expect(uniqueAssetName('Leaf icon', [])).toBe('leaf_icon')
    expect(uniqueAssetName('Leaf icon', ['leaf_icon'])).toBe('leaf_icon_2')
    expect(uniqueAssetName('Leaf icon', ['leaf_icon', 'leaf_icon_2'])).toBe('leaf_icon_3')
  })

  it('keeps numbered names within 32 characters and avoids reserved words', () => {
    const long = 'x'.repeat(40)
    const first = uniqueAssetName(long, [])
    expect(first).toHaveLength(32)
    const second = uniqueAssetName(long, [first])
    expect(second.length).toBeLessThanOrEqual(32)
    expect(second.endsWith('_2')).toBe(true)
    expect(uniqueAssetName('Slide', [])).toBe('slide_image')
  })

  it('falls back to "image" for an empty title', () => {
    expect(suggestAssetName('', [])).toBe('image')
    expect(suggestAssetName('???', ['image'])).toBe('image_2')
  })
})
