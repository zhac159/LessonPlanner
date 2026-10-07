import { describe, expect, it } from 'vitest'
import { isTextEntry } from './shortcuts'

describe('isTextEntry', () => {
  const make = (html: string): HTMLElement => {
    document.body.innerHTML = html
    return document.body.firstElementChild as HTMLElement
  }

  it('is true for text-like fields, selects and contenteditable', () => {
    expect(isTextEntry(make('<input type="text">'))).toBe(true)
    expect(isTextEntry(make('<input type="number">'))).toBe(true)
    expect(isTextEntry(make('<textarea></textarea>'))).toBe(true)
    expect(isTextEntry(make('<select></select>'))).toBe(true)
    const editable = make('<div></div>')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(isTextEntry(editable)).toBe(true)
  })

  it('is false for buttons, checkboxes, plain elements and no target', () => {
    expect(isTextEntry(make('<button></button>'))).toBe(false)
    expect(isTextEntry(make('<input type="checkbox">'))).toBe(false)
    expect(isTextEntry(make('<div></div>'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
