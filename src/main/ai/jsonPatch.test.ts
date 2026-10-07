import { describe, expect, it } from 'vitest'
import { PatchError, applyPatch, type PatchOp } from './jsonPatch'

const op = (kind: PatchOp['op'], path: string, value?: unknown): PatchOp => ({
  op: kind,
  path,
  valueJson: value === undefined ? '' : JSON.stringify(value)
})
const doc = () => ({
  tokens: { colors: { accent: { hex: '#111111' } } },
  habits: ['a', 'b'],
  'a/b': { 'c~d': 1 }
})

describe('applyPatch', () => {
  it('replaces, adds and removes object members', () => {
    const out = applyPatch(doc(), [
      op('replace', '/tokens/colors/accent/hex', '#222222'),
      op('add', '/tokens/colors/new', { hex: '#333333' }),
      op('remove', '/tokens/colors/accent')
    ])
    expect(out.tokens.colors).toEqual({ new: { hex: '#333333' } })
  })

  it('edits lists: append with "-", insert at an index, replace and remove', () => {
    const out = applyPatch(doc(), [
      op('add', '/habits/-', 'c'),
      op('add', '/habits/0', 'z'),
      op('replace', '/habits/1', 'A'),
      op('remove', '/habits/3')
    ])
    expect(out.habits).toEqual(['z', 'A', 'b'])
  })

  it('understands escaped pointer segments', () => {
    const out = applyPatch(doc(), [op('replace', '/a~1b/c~0d', 2)])
    expect(out['a/b']['c~d']).toBe(2)
  })

  it('never mutates the input', () => {
    const original = doc()
    applyPatch(original, [op('add', '/habits/-', 'x')])
    expect(original.habits).toEqual(['a', 'b'])
  })

  it.each([
    ['a path without a leading slash', op('replace', 'tokens', 1)],
    ['the whole document', op('replace', '/', 1)],
    ['a missing parent', op('add', '/nope/x', 1)],
    ['replacing a missing member', op('replace', '/tokens/missing', 1)],
    ['removing a missing member', op('remove', '/tokens/missing')],
    ['a list index out of range', op('replace', '/habits/9', 1)],
    ['a non-numeric list index', op('remove', '/habits/x')],
    [
      'invalid JSON in the value',
      { op: 'replace', path: '/habits/0', valueJson: '{oops' } as PatchOp
    ],
    ['going through a string', op('add', '/habits/0/x', 1)]
  ])('rejects %s', (_label, bad) => {
    expect(() => applyPatch(doc(), [bad])).toThrow(PatchError)
  })
})
