import { describe, expect, it } from 'vitest'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import { groupPlugins, matchesSearch } from './groups'

const plugin = (id: string, scope: PluginSummary['scope'], order: number): PluginSummary => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  description: `${id} things`,
  icon: 'plus',
  tint: 'sky',
  scope,
  hasInputs: false,
  needsSlides: false,
  order
})

describe('groupPlugins', () => {
  it('returns one group without a heading when every plugin has the same scope', () => {
    const groups = groupPlugins([plugin('quiz', 'lesson', 2), plugin('worksheet', 'lesson', 1)])
    expect(groups).toHaveLength(1)
    expect(groups[0].heading).toBeNull()
    expect(groups[0].plugins.map((p) => p.id)).toEqual(['worksheet', 'quiz'])
  })

  it('groups by scope under headings, in the fixed scope order, sorted by order inside', () => {
    const groups = groupPlugins([
      plugin('rewrite', 'region', 1),
      plugin('notes', 'slides', 2),
      plugin('quiz', 'lesson', 4),
      plugin('starter', 'lesson', 3)
    ])
    expect(groups.map((g) => g.heading)).toEqual(['Whole lesson', 'This slide', 'Circled area'])
    expect(groups[0].plugins.map((p) => p.id)).toEqual(['starter', 'quiz'])
  })

  it('drops scopes that have no plugins', () => {
    const groups = groupPlugins([plugin('quiz', 'lesson', 1), plugin('rewrite', 'region', 2)])
    expect(groups.map((g) => g.scope)).toEqual(['lesson', 'region'])
  })

  it('keeps the given order for equal `order` values and does not mutate the input', () => {
    const input = [plugin('b', 'lesson', 1), plugin('a', 'lesson', 1)]
    expect(groupPlugins(input)[0].plugins.map((p) => p.id)).toEqual(['b', 'a'])
    expect(input.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('returns no groups for no plugins', () => {
    expect(groupPlugins([])).toEqual([])
  })
})

describe('matchesSearch', () => {
  it('matches part of the name ignoring case and surrounding spaces', () => {
    expect(matchesSearch(plugin('quiz', 'lesson', 1), ' UI')).toBe(true)
    expect(matchesSearch(plugin('quiz', 'lesson', 1), 'worksheet')).toBe(false)
  })

  it('matches everything for an empty search', () => {
    expect(matchesSearch(plugin('quiz', 'lesson', 1), '  ')).toBe(true)
  })
})
