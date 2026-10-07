import { describe, expect, it } from 'vitest'
import {
  AssistantTokenGate,
  libraryOf,
  resolveMessageAssets,
  sanitiseAssistantTokens
} from './assetTokens'

const assets = [
  { id: 'ast_logo', name: 'school_logo' },
  { id: 'ast_leaf', name: 'leaf_photo' }
]
const library = libraryOf(() => assets)

describe('resolveMessageAssets (her message)', () => {
  it('pins each distinct token to an asset id and writes the current name', () => {
    const result = resolveMessageAssets(
      'Put {{School_Logo}} top right and {{old_leaf}} by the question, {{school_logo}} again',
      [
        { assetId: 'ast_logo', name: 'school_logo' },
        { assetId: 'ast_leaf', name: 'old_leaf' }
      ],
      library
    )
    expect(result).toEqual({
      ok: true,
      text: 'Put {{school_logo}} top right and {{leaf_photo}} by the question, {{school_logo}} again',
      refs: [
        { assetId: 'ast_logo', name: 'school_logo' },
        { assetId: 'ast_leaf', name: 'leaf_photo' }
      ]
    })
  })

  it('looks a name up in the library when no ref came with it', () => {
    expect(resolveMessageAssets('use {{leaf_photo}}', [], library)).toMatchObject({
      ok: true,
      refs: [{ assetId: 'ast_leaf', name: 'leaf_photo' }]
    })
  })

  it('names the asset that was deleted since she typed, and the one nobody knows', () => {
    expect(
      resolveMessageAssets('use {{old_owl}}', [{ assetId: 'ast_owl', name: 'old_owl' }], library)
    ).toEqual({
      ok: false,
      code: 'not-found',
      message: 'old_owl isn’t in your library any more.'
    })
    expect(resolveMessageAssets('use {{ghost}}', undefined, library)).toEqual({
      ok: false,
      code: 'invalid-input',
      message: 'No asset called ghost.'
    })
  })

  it('leaves a message without tokens alone and ignores refs that are not in the text', () => {
    expect(
      resolveMessageAssets(
        'make it bigger',
        [{ assetId: 'ast_logo', name: 'school_logo' }],
        library
      )
    ).toEqual({ ok: true, text: 'make it bigger', refs: [] })
    expect(resolveMessageAssets('x', [{ nonsense: 1 }, null, 'text'], library)).toMatchObject({
      ok: true
    })
  })
})

describe('sanitiseAssistantTokens (Claude’s reply)', () => {
  it('keeps known tokens in the library’s spelling and turns unknown ones into bare words', () => {
    expect(
      sanitiseAssistantTokens('I used {{School_Logo}} and {{invented_owl}} on slide 1.', library)
    ).toEqual({
      text: 'I used {{school_logo}} and invented_owl on slide 1.',
      refs: [{ assetId: 'ast_logo', name: 'school_logo' }]
    })
  })
})

describe('AssistantTokenGate (streamed deltas)', () => {
  const stream = (pieces: string[]) => {
    const gate = new AssistantTokenGate(library)
    const out = pieces.map((p) => gate.push(p))
    out.push(gate.flush())
    return { out, text: out.join(''), refs: gate.refs }
  }

  it('holds a token that is cut in half until it is complete', () => {
    const { out, text, refs } = stream(['I used {', '{school_', 'logo}', '} on the title slide.'])
    expect(out.slice(0, 3)).toEqual(['I used ', '', ''])
    expect(text).toBe('I used {{school_logo}} on the title slide.')
    expect(refs).toEqual([{ assetId: 'ast_logo', name: 'school_logo' }])
  })

  it('shows an unknown token as a bare word, however it was cut', () => {
    expect(stream(['See {{ow', 'l_mascot}}.']).text).toBe('See owl_mascot.')
    expect(stream(['See {{ghost}} and {{leaf_photo}}']).text).toBe('See ghost and {{leaf_photo}}')
  })

  it('lets text that only looks like the start of a token through at the end', () => {
    expect(stream(['a { b', ' and {{', 'unfinished']).text).toBe('a { b and {{unfinished')
    expect(stream(['ends with {']).text).toBe('ends with {')
  })

  it('does not hold ordinary text back', () => {
    expect(stream(['Hello ', 'there']).out).toEqual(['Hello ', 'there', ''])
  })
})
