import { describe, expect, it } from 'vitest'
import { applyPatch, finaliseCorrected, type PatchOp } from './corrections'
import { createDraftProfile } from './draft'
import type { StyleProfile } from './types'

const AT = '2026-10-06T12:00:00Z'
const base = (): StyleProfile => ({
  ...createDraftProfile('sty_1', 'Mine', '2026-10-06T10:00:00Z'),
  version: 3,
  habits: ['a', 'b']
})
const run = (ops: PatchOp[], profile = base()) => applyPatch(profile, ops, 'I never use yellow', AT)

describe('applyPatch', () => {
  it('replaces a value, bumps the version and records the correction', () => {
    const before = base()
    const result = run(
      [{ op: 'replace', path: '/tokens/colors/highlight/hex', value: '#00FF00' }],
      before
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.tokens.colors.highlight.hex).toBe('#00FF00')
    expect(result.profile.version).toBe(4)
    expect(result.profile.updatedAt).toBe(AT)
    expect(result.profile.corrections).toEqual([
      { text: 'I never use yellow', at: AT, appliedInVersion: 4 }
    ])
    expect(before.tokens.colors.highlight.hex).toBe('#FFE36E') // input not mutated
    expect(before.version).toBe(3)
  })

  it('adds to objects and arrays (index and "-") and removes', () => {
    const result = run([
      { op: 'add', path: '/habits/-', value: 'c' },
      { op: 'add', path: '/habits/0', value: 'z' },
      { op: 'remove', path: '/habits/1' },
      { op: 'add', path: '/components/chip', value: { description: 'Pill' } },
      { op: 'remove', path: '/tokens/colors/muted' }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile.habits).toEqual(['z', 'b', 'c'])
    expect(result.profile.components.chip.description).toBe('Pill')
    expect(result.profile.tokens.colors.muted).toBeUndefined()
  })

  it('decodes ~0 and ~1 in pointers', () => {
    const result = run([{ op: 'add', path: '/components/callout~1x', value: { description: 'x' } }])
    expect(result.ok && Object.keys(result.profile.components)).toContain('callout/x')
  })

  it.each<[string, PatchOp]>([
    ['protected field', { op: 'replace', path: '/id', value: 'evil' }],
    ['version', { op: 'replace', path: '/version', value: 99 }],
    ['sources', { op: 'remove', path: '/sources' }],
    ['prototype pollution', { op: 'add', path: '/components/__proto__/x', value: 1 }],
    ['constructor path', { op: 'add', path: '/constructor/prototype/x', value: 1 }],
    ['relative path', { op: 'add', path: 'habits/-', value: 'x' }],
    ['replace missing key', { op: 'replace', path: '/components/nope', value: {} }],
    ['remove missing key', { op: 'remove', path: '/components/nope' }],
    ['array index out of range', { op: 'replace', path: '/habits/9', value: 'x' }],
    ['non-numeric array index', { op: 'add', path: '/habits/x', value: 'x' }],
    ['through a missing parent', { op: 'add', path: '/nope/deeper/x', value: 1 }]
  ])('rejects %s without changing anything', (_name, op) => {
    const before = base()
    expect(run([op], before).ok).toBe(false)
    expect(before).toEqual(base())
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('rejects patches that make the profile invalid', () => {
    const result = run([{ op: 'replace', path: '/tokens/colors/text/hex', value: 'not-a-colour' }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/isn’t valid/)
  })

  it('rejects empty and oversized patches', () => {
    expect(run([]).ok).toBe(false)
    const many: PatchOp[] = Array.from({ length: 101 }, () => ({
      op: 'add',
      path: '/habits/-',
      value: 'x'
    }))
    expect(run(many).ok).toBe(false)
  })
})

describe('finaliseCorrected', () => {
  it('restores protected fields and records the correction', () => {
    const before = { ...base(), isDefault: true, status: 'ready' as const }
    const corrected = {
      ...before,
      id: 'other',
      isDefault: false,
      status: 'draft',
      version: 1,
      sources: [],
      habits: ['new']
    }
    const result = finaliseCorrected(before, corrected, 'text', AT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.profile).toMatchObject({
      id: 'sty_1',
      isDefault: true,
      status: 'ready',
      version: 4,
      habits: ['new']
    })
    expect(result.profile.corrections.at(-1)).toMatchObject({ text: 'text', appliedInVersion: 4 })
  })

  it('fails on invalid or non-object input', () => {
    expect(finaliseCorrected(base(), { nope: true }, 't', AT).ok).toBe(false)
    expect(finaliseCorrected(base(), null, 't', AT).ok).toBe(false)
    expect(finaliseCorrected(base(), [], 't', AT).ok).toBe(false)
  })
})
