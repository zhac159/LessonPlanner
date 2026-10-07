import { describe, expect, it } from 'vitest'
import { usageLine } from './usageLine'

describe('usageLine', () => {
  it('rounds the month’s cost to cents', () => {
    expect(usageLine({ month: '2026-10', calls: 3, costUsd: 1.234 })).toBe(
      'This month: about $1.23'
    )
    expect(usageLine({ month: '2026-10', calls: 0, costUsd: 0 })).toBe('This month: about $0.00')
    expect(usageLine({ month: '2026-10', calls: 9, costUsd: 12.5 })).toBe(
      'This month: about $12.50'
    )
  })
})
