import { describe, expect, it } from 'vitest'
import { isSubmitKey, type ComposerKeyEvent } from './keys'

const press = (over: Partial<ComposerKeyEvent> = {}): ComposerKeyEvent => ({
  key: 'Enter',
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
  ...over
})

describe('isSubmitKey', () => {
  it('sends on Enter when Enter sends', () => {
    expect(isSubmitKey(press(), true)).toBe(true)
  })

  it('adds a new line on Enter when Enter does not send', () => {
    expect(isSubmitKey(press(), false)).toBe(false)
  })

  it('never sends on Shift+Enter', () => {
    expect(isSubmitKey(press({ shiftKey: true }), true)).toBe(false)
    expect(isSubmitKey(press({ shiftKey: true }), false)).toBe(false)
  })

  it('always sends on Ctrl+Enter or Cmd+Enter', () => {
    expect(isSubmitKey(press({ ctrlKey: true }), false)).toBe(true)
    expect(isSubmitKey(press({ ctrlKey: true }), true)).toBe(true)
    expect(isSubmitKey(press({ metaKey: true }), false)).toBe(true)
  })

  it('ignores other keys', () => {
    expect(isSubmitKey(press({ key: 'a', ctrlKey: true }), true)).toBe(false)
    expect(isSubmitKey(press({ key: 'Escape' }), true)).toBe(false)
  })

  it('ignores Enter that confirms an IME composition', () => {
    expect(isSubmitKey(press({ isComposing: true }), true)).toBe(false)
    expect(isSubmitKey(press({ isComposing: true, ctrlKey: true }), true)).toBe(false)
  })
})
