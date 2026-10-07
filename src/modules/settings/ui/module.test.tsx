import { describe, expect, it } from 'vitest'
import { SETTINGS } from '@shared/contracts/settings'
import module from '../ui'

describe('settings ui module', () => {
  it('is the bottom sidebar item "Settings" with the sidebar chrome', () => {
    expect(module.id).toBe(SETTINGS)
    expect(module.title).toBe('Settings')
    expect(module.nav).toBe('bottom')
    expect(module.chrome).toBe('sidebar')
    expect(module.icon).toBeTruthy()
    expect(module.component).toBeTypeOf('function')
  })
})
