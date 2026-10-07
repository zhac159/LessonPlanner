import { describe, expect, it } from 'vitest'
import { buildNav, claudeStatus } from './navModel'

const icon = () => null
const modules = [
  { id: 'home', title: 'Home', icon },
  { id: 'styles', title: 'Styles', icon, nav: 'top' as const },
  { id: 'settings', title: 'Settings', icon, nav: 'bottom' as const },
  { id: 'new-lesson', title: 'New lesson', icon, nav: 'hidden' as const }
]

describe('buildNav', () => {
  it('excludes hidden modules and places bottom ones under the spacer', () => {
    const { items } = buildNav(modules, 'home', 'sidebar')
    expect(items.map((i) => [i.id, i.placement])).toEqual([
      ['home', 'top'],
      ['styles', 'top'],
      ['settings', 'bottom']
    ])
    expect(items[0]).toMatchObject({ label: 'Home', icon })
  })

  it('highlights the active module as the current page', () => {
    expect(buildNav(modules, 'styles', 'sidebar')).toMatchObject({
      highlightId: 'styles',
      current: 'page'
    })
  })

  it('keeps Home highlighted (aria-current true) in the rail while a hidden screen is open', () => {
    expect(buildNav(modules, 'new-lesson', 'rail')).toMatchObject({
      highlightId: 'home',
      current: 'true'
    })
  })

  it('falls back to the first item when Home does not exist', () => {
    const noHome = modules.filter((m) => m.id !== 'home')
    expect(buildNav(noHome, 'new-lesson', 'rail').highlightId).toBe('styles')
  })

  it('highlights nothing for a hidden module outside the rail', () => {
    expect(buildNav(modules, 'new-lesson', 'sidebar').highlightId).toBeUndefined()
  })

  it('copes with no modules', () => {
    expect(buildNav([], '', 'rail')).toEqual({ items: [], highlightId: undefined, current: 'true' })
  })
})

describe('claudeStatus', () => {
  it('words both states', () => {
    expect(claudeStatus(true)).toBe('Claude connected')
    expect(claudeStatus(false)).toBe('Claude isn’t connected')
  })
})
