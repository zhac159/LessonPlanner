import { describe, expect, it } from 'vitest'
import { makeSlide, makeText } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import { assetDataUrls, assetIdsUsedBy, sniffImageMime } from './assets'

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values)
const text = (value: string): Uint8Array => new TextEncoder().encode(value)

const picture = (id: string, assetId?: string): ImageElement => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  w: 100,
  h: 100,
  fit: 'cover',
  alt: id,
  assetId
})

describe('sniffImageMime', () => {
  it('recognises the formats browsers show', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe('image/png')
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageMime(text('GIF89a....'))).toBe('image/gif')
    expect(sniffImageMime(bytes(...text('RIFF'), 1, 2, 3, 4, ...text('WEBPVP8 ')))).toBe(
      'image/webp'
    )
    expect(sniffImageMime(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
      'image/svg+xml'
    )
    expect(sniffImageMime(text('  \n<?xml version="1.0"?><svg></svg>'))).toBe('image/svg+xml')
  })

  it('returns undefined for anything else, including empty and tiny input', () => {
    expect(sniffImageMime(bytes())).toBeUndefined()
    expect(sniffImageMime(bytes(0x89))).toBeUndefined()
    expect(sniffImageMime(text('%PDF-1.7'))).toBeUndefined()
    expect(sniffImageMime(text('<html><body>not an image</body></html>'))).toBeUndefined()
    expect(sniffImageMime(text('RIFF....WAVE'))).toBeUndefined()
  })
})

describe('assetIdsUsedBy', () => {
  it('lists the asset ids of pictures once each, ignoring placeholders and other elements', () => {
    const slide = makeSlide('s1', {
      elements: [
        picture('a', 'x.png'),
        picture('b'),
        picture('c', 'x.png'),
        picture('d', 'y.jpg'),
        makeText('t', 'hi')
      ]
    })
    expect(assetIdsUsedBy(slide)).toEqual(['x.png', 'y.jpg'])
  })
})

describe('assetDataUrls', () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 1, 2, 3)

  it('encodes the used assets as data URLs and leaves the rest out', () => {
    const slide = makeSlide('s1', { elements: [picture('a', 'x.png')] })
    const urls = assetDataUrls(slide, { 'x.png': png, 'other.png': png })
    expect(Object.keys(urls)).toEqual(['x.png'])
    expect(urls['x.png']).toBe(`data:image/png;base64,${Buffer.from(png).toString('base64')}`)
  })

  it('skips assets that are missing or not pictures, so the placeholder shows', () => {
    const slide = makeSlide('s1', {
      elements: [picture('a', 'gone.png'), picture('b', 'doc.pdf')]
    })
    expect(assetDataUrls(slide, { 'doc.pdf': text('%PDF-1.7') })).toEqual({})
    expect(assetDataUrls(slide, undefined)).toEqual({})
  })
})
