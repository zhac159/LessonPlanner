import { describe, expect, it } from 'vitest'
import { keysOf } from './names'

interface Sample {
  a(): void
  'b:c'(): void
}

describe('keysOf', () => {
  it('returns the complete list unchanged, in any order', () => {
    expect(keysOf<Sample>()(['b:c', 'a'])).toEqual(['b:c', 'a'])
  })

  it('rejects a missing key at compile time', () => {
    // @ts-expect-error 'b:c' is missing from the list
    const list = keysOf<Sample>()(['a'])
    expect(list).toEqual(['a'])
  })

  it('rejects an unknown key at compile time', () => {
    // @ts-expect-error 'z' is not a key of Sample
    const list = keysOf<Sample>()(['a', 'b:c', 'z'])
    expect(list).toHaveLength(3)
  })
})
