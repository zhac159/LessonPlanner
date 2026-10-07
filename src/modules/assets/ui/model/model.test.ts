import { describe, expect, it } from 'vitest'
import { checkAssetName } from '@shared/assets/names'
import { commonKind, suggestMakeName } from './makeName'
import { addedMessage, addedToLibrary, rejectionMessages } from './messages'
import { routeForIntent } from './route'

describe('routeForIntent', () => {
  it('opens the library, the review (with a batch), online (with a query) and make (with ids)', () => {
    expect(routeForIntent({ kind: 'library' })).toMatchObject({ screen: 'page', tab: 'library' })
    expect(routeForIntent({ kind: 'review', batchId: 'b1' })).toMatchObject({
      screen: 'review',
      batchId: 'b1'
    })
    expect(routeForIntent({ kind: 'online', query: 'volcano' })).toMatchObject({
      tab: 'online',
      onlineQuery: 'volcano'
    })
    expect(routeForIntent({ kind: 'make', basedOn: ['a', 3, 'b'] })).toMatchObject({
      basedOn: ['a', 'b']
    })
  })

  it('ignores a blank batch or query and gives every intent its own key', () => {
    const first = routeForIntent({ kind: 'online', query: '  ' })
    const second = routeForIntent({ kind: 'online', query: '  ' })
    expect(first).toMatchObject({ onlineQuery: undefined })
    expect(first!.key).not.toBe(second!.key)
  })

  it('does not know other intents', () => {
    expect(routeForIntent({ kind: 'something-else' })).toBeNull()
  })
})

describe('suggestMakeName', () => {
  it('builds the example name from the example request', () => {
    expect(suggestMakeName('A Bunsen burner with a lit flame', 'icon')).toBe('bunsen_burner_icon')
  })

  it('always gives a valid name, or nothing without letters', () => {
    for (const prompt of ['The water cycle', 'a volcano erupting at night in a very dark sky!!']) {
      const name = suggestMakeName(prompt, 'diagram')
      expect(checkAssetName(name, new Set()).ok).toBe(true)
    }
    expect(suggestMakeName('   ', 'icon')).toBe('')
    expect(suggestMakeName('!!!', 'icon')).toBe('')
  })

  it('does not repeat the kind and leaves plain pictures without a suffix', () => {
    expect(suggestMakeName('a leaf icon', 'icon')).toBe('leaf_icon')
    expect(suggestMakeName('a leaf', 'picture')).toBe('leaf')
  })
})

describe('commonKind', () => {
  it('picks the most common kind, the first seen on a tie, and picture for none', () => {
    expect(commonKind(['icon', 'logo', 'icon'])).toBe('icon')
    expect(commonKind(['logo', 'icon'])).toBe('logo')
    expect(commonKind([])).toBe('picture')
  })
})

describe('messages', () => {
  it('says what was refused, one line per reason', () => {
    expect(
      rejectionMessages([
        { name: 'notes.docx', reason: 'type' },
        { name: 'a.png', reason: 'too-large' },
        { name: 'b.png', reason: 'too-large' }
      ])
    ).toEqual(['notes.docx isn’t a picture, PDF or PowerPoint I can use.', '2 files are too big.'])
  })

  it('counts what was added and what is being read', () => {
    expect(addedToLibrary(1)).toBe('1 asset added to Your assets')
    expect(addedToLibrary(9)).toBe('9 assets added to Your assets')
    expect(addedMessage({ batchId: 'b', accepted: 0, rejected: [] })).toBeNull()
    expect(addedMessage({ batchId: 'b', accepted: 2, rejected: [] })).toContain('2 files')
  })
})
