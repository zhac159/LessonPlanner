import { describe, expect, it } from 'vitest'
import { defaultInputs, defaultValue, validateInputs } from './inputs'
import type { PluginInput } from './manifest'

const inputs: PluginInput[] = [
  { id: 'slides', type: 'slideRange', label: 'Which slides?', default: 'all' },
  {
    id: 'count',
    type: 'number',
    label: 'How many?',
    min: 3,
    max: 30,
    step: 1,
    default: 10,
    decrementLabel: 'Fewer',
    incrementLabel: 'More'
  },
  {
    id: 'types',
    type: 'multi',
    label: 'Types',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' }
    ],
    default: ['a'],
    minSelected: 1
  },
  {
    id: 'level',
    type: 'choice',
    label: 'Level',
    options: [
      { value: 'core', label: 'Core' },
      { value: 'stretch', label: 'Stretch' }
    ],
    default: 'core'
  },
  { id: 'extra', type: 'text', label: 'Extra', maxLength: 10 },
  { id: 'flag', type: 'boolean', label: 'Flag', default: false }
]
const manifest = { inputs }

describe('defaults', () => {
  it('uses each input’s default and an empty string for text', () => {
    expect(defaultInputs(manifest)).toEqual({
      slides: 'all',
      count: 10,
      types: ['a'],
      level: 'core',
      extra: '',
      flag: false
    })
    expect(defaultValue(inputs[4])).toBe('')
    expect(defaultInputs({ inputs: [] })).toEqual({})
  })
})

describe('validateInputs', () => {
  it('fills in defaults for missing values and drops unknown keys', () => {
    expect(validateInputs(manifest, { count: 5, unknown: true })).toEqual({
      ok: true,
      inputs: { slides: 'all', count: 5, types: ['a'], level: 'core', extra: '', flag: false }
    })
    expect(validateInputs(manifest, {}).ok).toBe(true)
  })

  it('rejects input that is not an object', () => {
    for (const raw of [null, 'x', 5, [], undefined])
      expect(validateInputs(manifest, raw)).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('slideRange accepts only all, selected or current', () => {
    for (const ok of ['all', 'selected', 'current'])
      expect(validateInputs(manifest, { slides: ok }).ok).toBe(true)
    expect(validateInputs(manifest, { slides: 'some' })).toMatchObject({
      ok: false,
      message: 'Which slides?: choose all, selected or current'
    })
  })

  it('number rounds to the step, clamps to the range and rejects non-numbers', () => {
    expect(validateInputs(manifest, { count: 4.6 })).toMatchObject({ inputs: { count: 5 } })
    expect(validateInputs(manifest, { count: 1 })).toMatchObject({ inputs: { count: 3 } })
    expect(validateInputs(manifest, { count: 500 })).toMatchObject({ inputs: { count: 30 } })
    for (const bad of ['7', NaN, Infinity, null])
      expect(validateInputs(manifest, { count: bad })).toMatchObject({
        ok: false,
        message: 'How many?: enter a number'
      })
  })

  it('number respects a step larger than one', () => {
    const stepped = {
      inputs: [{ ...(inputs[1] as object), step: 5, min: 5, max: 50 } as PluginInput]
    }
    expect(validateInputs(stepped, { count: 12 })).toMatchObject({ inputs: { count: 10 } })
    expect(validateInputs(stepped, { count: 13 })).toMatchObject({ inputs: { count: 15 } })
  })

  it('multi needs listed values, removes repeats and honours minSelected', () => {
    expect(validateInputs(manifest, { types: ['b', 'b', 'a'] })).toMatchObject({
      inputs: { types: ['b', 'a'] }
    })
    expect(validateInputs(manifest, { types: [] })).toMatchObject({
      ok: false,
      message: 'Types: choose at least 1'
    })
    expect(validateInputs(manifest, { types: ['z'] })).toMatchObject({ ok: false })
    expect(validateInputs(manifest, { types: 'a' })).toMatchObject({ ok: false })
    expect(validateInputs(manifest, { types: [1] })).toMatchObject({ ok: false })
  })

  it('choice needs one of the options', () => {
    expect(validateInputs(manifest, { level: 'stretch' }).ok).toBe(true)
    expect(validateInputs(manifest, { level: 'hard' })).toMatchObject({ ok: false })
    expect(validateInputs(manifest, { level: 3 })).toMatchObject({ ok: false })
  })

  it('text is trimmed, limited in length and may be required', () => {
    expect(validateInputs(manifest, { extra: '  hi  ' })).toMatchObject({ inputs: { extra: 'hi' } })
    expect(validateInputs(manifest, { extra: 'x'.repeat(11) })).toMatchObject({
      ok: false,
      message: 'Extra: use at most 10 characters'
    })
    expect(validateInputs(manifest, { extra: 5 })).toMatchObject({ ok: false })
    const required: PluginInput = { id: 't', type: 'text', label: 'Topic', required: true }
    expect(validateInputs({ inputs: [required] }, { t: '   ' })).toMatchObject({
      ok: false,
      message: 'Topic: this is required'
    })
    expect(validateInputs({ inputs: [required] }, {})).toMatchObject({ ok: false })
  })

  it('boolean needs a boolean', () => {
    expect(validateInputs(manifest, { flag: true })).toMatchObject({ inputs: { flag: true } })
    expect(validateInputs(manifest, { flag: 'true' })).toMatchObject({ ok: false })
  })
})
