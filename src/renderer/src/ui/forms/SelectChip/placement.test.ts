import { describe, expect, it } from 'vitest'
import { computePlacement } from './placement'

const viewport = { viewportWidth: 1000, viewportHeight: 800 }
const menu = { menuWidth: 200, menuHeight: 240 }

describe('computePlacement', () => {
  it('opens 8px below, left-aligned with the trigger', () => {
    const p = computePlacement({
      anchor: { top: 100, left: 50, width: 120, height: 44 },
      ...menu,
      ...viewport
    })
    expect(p).toMatchObject({ side: 'below', top: 152, left: 50 })
  })

  it('flips above when there is no room below but room above', () => {
    const p = computePlacement({
      anchor: { top: 700, left: 50, width: 120, height: 44 },
      ...menu,
      ...viewport
    })
    expect(p).toMatchObject({ side: 'above', top: 700 - 8 - 240 })
  })

  it('stays below when it fits neither side', () => {
    const p = computePlacement({
      anchor: { top: 100, left: 50, width: 120, height: 44 },
      menuWidth: 200,
      menuHeight: 900,
      ...viewport
    })
    expect(p.side).toBe('below')
  })

  it('keeps the popup inside the viewport horizontally', () => {
    const right = computePlacement({
      anchor: { top: 100, left: 950, width: 40, height: 44 },
      ...menu,
      ...viewport
    })
    expect(right.left).toBe(1000 - 200 - 8)
    const left = computePlacement({
      anchor: { top: 100, left: -30, width: 40, height: 44 },
      ...menu,
      ...viewport
    })
    expect(left.left).toBe(8)
  })

  it('puts the transform origin at the trigger centre', () => {
    const p = computePlacement({
      anchor: { top: 100, left: 50, width: 120, height: 44 },
      ...menu,
      ...viewport
    })
    expect(p.originX).toBe(60)
  })
})
