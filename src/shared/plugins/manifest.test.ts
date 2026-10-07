import { describe, expect, it } from 'vitest'
import type { PluginManifest } from './manifest'
import { defineManifest, toSummary, toView, validateManifest } from './manifest'

const base = (over: Partial<PluginManifest> = {}): PluginManifest => ({
  id: 'quiz',
  name: 'Quiz',
  title: 'Quiz from slides',
  description: 'Quick-check questions in your format',
  icon: 'list-checks',
  tint: 'peach',
  scope: 'lesson',
  inputs: [],
  output: ['slides'],
  action: 'Make quiz',
  needsSlides: true,
  usesStyle: true,
  ...over
})

describe('validateManifest', () => {
  it('accepts a manifest that follows the design rules', () => {
    expect(validateManifest(base())).toBeNull()
    expect(validateManifest(base({ name: 'Speaker notes' }))).toBeNull()
  })

  it.each([
    ['an id that is not kebab-case', { id: 'My_Plugin' }, /invalid plugin id/],
    ['a three-word name', { name: 'Make a quiz' }, /name/],
    ['an empty name', { name: ' ' }, /name/],
    ['an empty title', { title: '' }, /title/],
    ['a description over 44 characters', { description: 'x'.repeat(45) }, /description/],
    ['an empty description', { description: '' }, /description/],
    ['an emoji icon', { icon: '🧠' }, /icon/],
    ['an icon with capitals', { icon: 'ListChecks' }, /icon/],
    ['no action label', { action: '' }, /action/],
    ['no output', { output: [] }, /output/]
  ] as const)('rejects %s', (_label, over, message) => {
    expect(validateManifest(base(over as Partial<PluginManifest>))).toMatch(message)
  })

  it('rejects duplicate input ids and unlabeled inputs', () => {
    const flag = { id: 'a', type: 'boolean', label: 'A', default: true } as const
    expect(validateManifest(base({ inputs: [flag, flag] }))).toMatch(/duplicate input id "a"/)
    expect(validateManifest(base({ inputs: [{ ...flag, label: '' }] }))).toMatch(/label/)
  })

  it('checks input defaults: numbers inside their range, choices and multis among their options', () => {
    const number = {
      id: 'n',
      type: 'number',
      label: 'N',
      min: 3,
      max: 30,
      step: 1,
      default: 10,
      decrementLabel: 'Fewer',
      incrementLabel: 'More'
    } as const
    expect(validateManifest(base({ inputs: [number] }))).toBeNull()
    expect(validateManifest(base({ inputs: [{ ...number, default: 2 }] }))).toMatch(/outside/)
    expect(validateManifest(base({ inputs: [{ ...number, step: 0 }] }))).toMatch(/step/)
    const options = [{ value: 'a', label: 'A' }]
    expect(
      validateManifest(
        base({ inputs: [{ id: 'c', type: 'choice', label: 'C', options, default: 'b' }] })
      )
    ).toMatch(/not one of the options/)
    expect(
      validateManifest(
        base({ inputs: [{ id: 'm', type: 'multi', label: 'M', options, default: ['z'] }] })
      )
    ).toMatch(/not options/)
    expect(
      validateManifest(
        base({ inputs: [{ id: 'm', type: 'multi', label: 'M', options, default: ['a'] }] })
      )
    ).toBeNull()
  })
})

describe('views of a manifest', () => {
  it('toSummary builds the "+" menu row', () => {
    const inputs = [{ id: 'a', type: 'boolean', label: 'A', default: true }] as const
    expect(toSummary(base({ inputs: [...inputs] }), 4)).toEqual({
      id: 'quiz',
      name: 'Quiz',
      description: 'Quick-check questions in your format',
      icon: 'list-checks',
      tint: 'peach',
      scope: 'lesson',
      hasInputs: true,
      needsSlides: true,
      order: 4
    })
    expect(toSummary(base(), 0).hasInputs).toBe(false)
  })

  it('toView leaves out what only main needs', () => {
    const view = toView(base({ order: 3, estimate: 'About 20 seconds' }))
    expect(view).not.toHaveProperty('usesStyle')
    expect(view).not.toHaveProperty('order')
    expect(view).toMatchObject({ id: 'quiz', action: 'Make quiz', estimate: 'About 20 seconds' })
  })

  it('defineManifest returns the manifest unchanged', () => {
    const manifest = base()
    expect(defineManifest(manifest)).toBe(manifest)
  })
})
