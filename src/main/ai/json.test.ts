import { describe, expect, it } from 'vitest'
import { parsePartialJson, stableStringify } from './json'

describe('stableStringify', () => {
  it('sorts keys at every depth so equal data renders identically', () => {
    const a = { b: 1, a: { d: [{ y: 1, x: 2 }], c: 'z' } }
    const b = { a: { c: 'z', d: [{ x: 2, y: 1 }] }, b: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
    expect(stableStringify(a)).toBe('{"a":{"c":"z","d":[{"x":2,"y":1}]},"b":1}')
  })

  it('keeps array order and drops undefined', () => {
    expect(stableStringify({ list: [3, 1, 2], gone: undefined })).toBe('{"list":[3,1,2]}')
  })

  it('handles primitives and null', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify('x')).toBe('"x"')
  })
})

describe('parsePartialJson', () => {
  it('parses complete JSON as is', () => {
    expect(parsePartialJson('{"a":[1,2]}')).toEqual({ a: [1, 2] })
  })

  it('closes an open string and brackets', () => {
    expect(parsePartialJson('{"title":"Photosyn')).toEqual({ title: 'Photosyn' })
    expect(parsePartialJson('{"items":["a","b')).toEqual({ items: ['a', 'b'] })
  })

  it('drops an unusable tail back to the last complete item', () => {
    expect(parsePartialJson('{"slides":[{"n":1},{"n":2},{"n":')).toEqual({
      slides: [{ n: 1 }, { n: 2 }]
    })
    expect(parsePartialJson('{"a":1,"b":tru')).toEqual({ a: 1 })
    expect(parsePartialJson('{"a":1,"long key')).toEqual({ a: 1 })
  })

  it('is not fooled by brackets and commas inside strings', () => {
    expect(parsePartialJson('{"t":"a, b ] } \\" c","u":"x')).toEqual({ t: 'a, b ] } " c', u: 'x' })
  })

  it('returns undefined before anything useful has arrived', () => {
    expect(parsePartialJson('')).toBeUndefined()
    expect(parsePartialJson('{"a":')).toBeUndefined()
  })
})
