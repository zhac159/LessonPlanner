import { describe, expect, it, vi } from 'vitest'
import { mergeRefs } from './mergeRefs'

describe('mergeRefs', () => {
  it('sets object refs and calls callback refs', () => {
    const object = { current: null as string | null }
    const callback = vi.fn()
    mergeRefs<string>(object, callback, undefined)('node')
    expect(object.current).toBe('node')
    expect(callback).toHaveBeenCalledWith('node')
  })

  it('clears refs when the node goes away', () => {
    const object = { current: 'x' as string | null }
    mergeRefs<string>(object)(null)
    expect(object.current).toBeNull()
  })
})
