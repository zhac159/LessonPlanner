import { describe, expect, it } from 'vitest'
import { AUTOMATION_ARG, isAutomatedLaunch, resolveAutomation } from './automation'

const stray = {
  SLIDE_PLANNER_TEST: '1',
  SLIDE_PLANNER_HEADLESS: '1',
  SLIDE_PLANNER_DISPLAY: '1',
  CLAUDECODE: '1'
}

describe('resolveAutomation in a packaged build', () => {
  it('ignores every automation variable and switch without the explicit unlock', () => {
    for (const argv of [[], ['--remote-debugging-pipe'], ['--user-data-dir=x']]) {
      expect(resolveAutomation({ env: stray, argv, isPackaged: true })).toEqual({
        testMode: false,
        automated: false,
        hidden: false,
        displayEnv: undefined
      })
    }
  })

  it('honours the environment once the unlock argument is present', () => {
    const result = resolveAutomation({ env: stray, argv: [AUTOMATION_ARG], isPackaged: true })
    expect(result).toEqual({ testMode: true, automated: true, hidden: true, displayEnv: '1' })
  })

  it('lets HEADLESS=0 show an unlocked automated window', () => {
    const env = { SLIDE_PLANNER_TEST: '1', SLIDE_PLANNER_HEADLESS: '0' }
    const result = resolveAutomation({ env, argv: [AUTOMATION_ARG], isPackaged: true })
    expect(result).toMatchObject({ automated: true, hidden: false })
  })
})

describe('resolveAutomation in development', () => {
  const dev = { isPackaged: false }

  it('is off for a plain launch', () => {
    expect(resolveAutomation({ env: {}, argv: [], ...dev })).toMatchObject({
      testMode: false,
      automated: false,
      hidden: false
    })
  })

  it.each([
    ['SLIDE_PLANNER_TEST', { SLIDE_PLANNER_TEST: '1' }, []],
    ['CLAUDECODE', { CLAUDECODE: '1' }, []],
    ['--remote-debugging-pipe', {}, ['--remote-debugging-pipe']]
  ])('hides the window for %s', (_name, env, argv) => {
    expect(resolveAutomation({ env, argv, ...dev })).toMatchObject({
      automated: true,
      hidden: true
    })
  })

  it('keeps testMode tied to SLIDE_PLANNER_TEST only', () => {
    expect(resolveAutomation({ env: { CLAUDECODE: '1' }, argv: [], ...dev }).testMode).toBe(false)
    expect(resolveAutomation({ env: { SLIDE_PLANNER_TEST: '1' }, argv: [], ...dev }).testMode).toBe(
      true
    )
  })

  it('SLIDE_PLANNER_HEADLESS=1 hides even a normal launch, =0 shows an automated one', () => {
    expect(
      resolveAutomation({ env: { SLIDE_PLANNER_HEADLESS: '1' }, argv: [], ...dev }).hidden
    ).toBe(true)
    const shown = resolveAutomation({
      env: { CLAUDECODE: '1', SLIDE_PLANNER_HEADLESS: '0' },
      argv: [],
      ...dev
    })
    expect(shown).toMatchObject({ automated: true, hidden: false })
  })
})

describe('isAutomatedLaunch', () => {
  it('recognises the unlock and Playwright/CDP switches, not a normal double-click', () => {
    expect(isAutomatedLaunch([AUTOMATION_ARG])).toBe(true)
    expect(isAutomatedLaunch(['--remote-debugging-pipe'])).toBe(true)
    expect(isAutomatedLaunch(['--remote-debugging-port=9222'])).toBe(true)
    expect(isAutomatedLaunch([])).toBe(false)
    expect(isAutomatedLaunch(['C:\\Apps\\Slide Planner.exe'])).toBe(false)
  })
})
