import { describe, expect, it } from 'vitest'
import { menuFocusTarget, menuRows, typeaheadMatch } from './menuNav'

describe('menuRows', () => {
  it('lays each group out two to a row', () => {
    expect(menuRows([5])).toEqual([[0, 1], [2, 3], [4]])
  })

  it('starts a new row for each group', () => {
    expect(menuRows([3, 2])).toEqual([[0, 1], [2], [3, 4]])
  })

  it('is empty without tiles', () => {
    expect(menuRows([])).toEqual([])
    expect(menuRows([0])).toEqual([])
  })
})

describe('menuFocusTarget (6 tiles, Manage = 6)', () => {
  const sizes = [6]

  it('moves one tile left and right, stopping at the ends', () => {
    expect(menuFocusTarget('ArrowRight', 0, sizes)).toBe(1)
    expect(menuFocusTarget('ArrowRight', 1, sizes)).toBe(2)
    expect(menuFocusTarget('ArrowLeft', 3, sizes)).toBe(2)
    expect(menuFocusTarget('ArrowLeft', 0, sizes)).toBeNull()
    expect(menuFocusTarget('ArrowRight', 5, sizes)).toBeNull()
  })

  it('moves a row up and down keeping the column', () => {
    expect(menuFocusTarget('ArrowDown', 0, sizes)).toBe(2)
    expect(menuFocusTarget('ArrowDown', 3, sizes)).toBe(5)
    expect(menuFocusTarget('ArrowUp', 5, sizes)).toBe(3)
    expect(menuFocusTarget('ArrowUp', 2, sizes)).toBe(0)
  })

  it('reaches Manage from the first row going up and the last row going down', () => {
    expect(menuFocusTarget('ArrowUp', 0, sizes)).toBe(6)
    expect(menuFocusTarget('ArrowUp', 1, sizes)).toBe(6)
    expect(menuFocusTarget('ArrowDown', 4, sizes)).toBe(6)
  })

  it('leaves Manage with Down to the first tile, Up to the last, sideways nowhere', () => {
    expect(menuFocusTarget('ArrowDown', 6, sizes)).toBe(0)
    expect(menuFocusTarget('ArrowUp', 6, sizes)).toBe(5)
    expect(menuFocusTarget('ArrowLeft', 6, sizes)).toBeNull()
    expect(menuFocusTarget('ArrowRight', 6, sizes)).toBeNull()
  })

  it('jumps to the first and last tile with Home and End', () => {
    expect(menuFocusTarget('Home', 4, sizes)).toBe(0)
    expect(menuFocusTarget('End', 0, sizes)).toBe(5)
    expect(menuFocusTarget('End', 6, sizes)).toBe(5)
  })

  it('ignores other keys', () => {
    expect(menuFocusTarget('Enter', 0, sizes)).toBeNull()
    expect(menuFocusTarget('q', 0, sizes)).toBeNull()
  })
})

describe('menuFocusTarget with an odd last row', () => {
  it('clamps the column to the shorter row', () => {
    expect(menuFocusTarget('ArrowDown', 3, [5])).toBe(4)
    expect(menuFocusTarget('ArrowUp', 4, [5])).toBe(2)
  })

  it('follows rows across groups', () => {
    // Groups [3, 2]: rows [0,1] [2] [3,4]
    expect(menuFocusTarget('ArrowDown', 1, [3, 2])).toBe(2)
    expect(menuFocusTarget('ArrowDown', 2, [3, 2])).toBe(3)
    expect(menuFocusTarget('ArrowUp', 4, [3, 2])).toBe(2)
  })
})

describe('menuFocusTarget without tiles', () => {
  it('never moves', () => {
    expect(menuFocusTarget('ArrowDown', 0, [])).toBeNull()
    expect(menuFocusTarget('Home', 0, [])).toBeNull()
  })
})

describe('typeaheadMatch', () => {
  const labels = [
    'Quiz',
    'Differentiate',
    'Worksheet',
    'Speaker notes',
    'Starter & plenary',
    'More plugins',
    'Manage'
  ]

  it('finds the next label starting with the letter, after the current one', () => {
    expect(typeaheadMatch(labels, 's', 0)).toBe(3)
    expect(typeaheadMatch(labels, 's', 3)).toBe(4)
    expect(typeaheadMatch(labels, 's', 4)).toBe(3)
  })

  it('wraps around the end', () => {
    expect(typeaheadMatch(labels, 'q', 3)).toBe(0)
  })

  it('matches a longer prefix, including on the current item', () => {
    expect(typeaheadMatch(labels, 'sta', 3)).toBe(4)
    expect(typeaheadMatch(labels, 'spe', 3)).toBe(3)
  })

  it('cycles with a repeated letter', () => {
    expect(typeaheadMatch(labels, 'mm', 5)).toBe(6)
  })

  it('is case-insensitive and returns -1 for no match or an empty buffer', () => {
    expect(typeaheadMatch(labels, 'W', 0)).toBe(2)
    expect(typeaheadMatch(labels, 'zz', 0)).toBe(-1)
    expect(typeaheadMatch(labels, '', 0)).toBe(-1)
  })
})
