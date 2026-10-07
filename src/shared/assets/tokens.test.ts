import { describe, expect, it } from 'vitest'
import {
  assetRefsInText,
  assetTokenNames,
  completeOpenToken,
  formatAssetToken,
  insertAssetToken,
  openAssetToken,
  parseAssetTokens,
  resolveAssetTokens,
  segmentsToText,
  unknownAssetNames
} from './tokens'
import type { ChatAssetRef } from './types'

const library: Record<string, ChatAssetRef> = {
  school_logo: { assetId: 'ast_1', name: 'school_logo' },
  owl_mascot: { assetId: 'ast_2', name: 'owl_mascot' }
}
const lookup = (name: string): ChatAssetRef | undefined => library[name]

describe('parseAssetTokens', () => {
  it('splits text and tokens in order and lower-cases names', () => {
    expect(parseAssetTokens('Put {{School_Logo}} in the top right')).toEqual([
      { type: 'text', text: 'Put ' },
      { type: 'asset', name: 'school_logo', raw: '{{School_Logo}}' },
      { type: 'text', text: ' in the top right' }
    ])
  })

  it('allows spaces inside the braces and leaves odd braces alone', () => {
    expect(parseAssetTokens('{{ owl_mascot }}')).toEqual([
      { type: 'asset', name: 'owl_mascot', raw: '{{ owl_mascot }}' }
    ])
    expect(parseAssetTokens('use {{not a name}} or {single} or {{}}')).toEqual([
      { type: 'text', text: 'use {{not a name}} or {single} or {{}}' }
    ])
    expect(parseAssetTokens('')).toEqual([])
  })

  it('lists distinct names once', () => {
    expect(assetTokenNames('{{a_b}} then {{c_d}} then {{A_B}}')).toEqual(['a_b', 'c_d'])
  })
})

describe('resolving tokens to chips', () => {
  it('turns known names into chips and keeps unknown ones as missing', () => {
    const segments = resolveAssetTokens('Put {{school_logo}} and {{nope}}', lookup)
    expect(segments.map((s) => s.type)).toEqual(['text', 'chip', 'text', 'missing'])
    expect(segments[1]).toEqual({ type: 'chip', assetId: 'ast_1', name: 'school_logo' })
    expect(unknownAssetNames('{{nope}} {{nope}} {{owl_mascot}}', lookup)).toEqual(['nope'])
  })

  it('round-trips chips back to the text that is sent', () => {
    const text = 'Now add {{owl_mascot}} next to {{ School_Logo }}, a bit smaller'
    expect(segmentsToText(resolveAssetTokens(text, lookup))).toBe(
      'Now add {{owl_mascot}} next to {{school_logo}}, a bit smaller'
    )
    expect(segmentsToText(resolveAssetTokens('{{nope}}', lookup))).toBe('{{nope}}')
  })

  it('collects one ref per distinct known asset', () => {
    expect(
      assetRefsInText('{{school_logo}} {{owl_mascot}} {{school_logo}} {{x_y}}', lookup)
    ).toEqual([
      { assetId: 'ast_1', name: 'school_logo' },
      { assetId: 'ast_2', name: 'owl_mascot' }
    ])
  })
})

describe('typing {{ opens the picker', () => {
  it('finds the open token before the caret', () => {
    expect(openAssetToken('Put {{', 6)).toEqual({ start: 4, query: '' })
    expect(openAssetToken('Put {{sch', 9)).toEqual({ start: 4, query: 'sch' })
    expect(openAssetToken('Put {{school_logo}} here', 24)).toBeNull()
    expect(openAssetToken('Put {{sch and', 13)).toBeNull()
    expect(openAssetToken('Put {{sch', 5)).toBeNull()
  })

  it('completes the open token and moves the caret past the space', () => {
    expect(completeOpenToken('Put {{sch in the corner', 9, 'school_logo')).toEqual({
      text: 'Put {{school_logo}} in the corner',
      caret: 20
    })
    expect(completeOpenToken('Put {{sch', 9, 'school_logo')).toEqual({
      text: 'Put {{school_logo}} ',
      caret: 20
    })
    expect(completeOpenToken('Put {{sch}} now', 9, 'owl_mascot')?.text).toBe(
      'Put {{owl_mascot}} now'
    )
    expect(completeOpenToken('no token', 8, 'owl_mascot')).toBeNull()
  })

  it('inserts a token from the + menu with sensible spacing', () => {
    expect(insertAssetToken('', 0, 'school_logo')).toEqual({ text: '{{school_logo}} ', caret: 16 })
    expect(insertAssetToken('Put', 3, 'school_logo')).toEqual({
      text: 'Put {{school_logo}} ',
      caret: 20
    })
    expect(insertAssetToken('Put  in the corner', 4, 'school_logo').text).toBe(
      'Put {{school_logo}} in the corner'
    )
  })

  it('formats a token', () => {
    expect(formatAssetToken('timer_icon')).toBe('{{timer_icon}}')
  })
})
