import { describe, expect, it } from 'vitest'
import type { TestOutcome } from './outcome'
import { FREE_TEST_NOTE, pictureOutcomeCopy } from './pictureOutcome'

const CODES: TestOutcome[] = [
  'connected',
  'no-key',
  'invalid-key',
  'no-credit',
  'permission',
  'model-unavailable',
  'rate-limited',
  'overloaded',
  'network',
  'too-large',
  'refused',
  'unknown'
]

describe('pictureOutcomeCopy', () => {
  it('says Connected with nothing more to add', () => {
    expect(pictureOutcomeCopy('connected')).toEqual({ pill: 'Connected', helper: null })
  })

  it.each([
    ['invalid-key', 'Google didn’t accept that key.'],
    [
      'no-credit',
      'Google says this key has no credit. Picture makers need a paid Google project (a $5 top-up).'
    ],
    ['rate-limited', 'Google is busy. Try again in a minute.'],
    ['network', 'Couldn’t reach Google. Check your internet.'],
    ['model-unavailable', 'That picture maker isn’t available on this key.']
  ] as const)('words %s the way the A7 spec does', (code, helper) => {
    expect(pictureOutcomeCopy(code).helper).toBe(helper)
  })

  it('gives every code a pill, and an error helper for all but connected', () => {
    for (const code of CODES) {
      const copy = pictureOutcomeCopy(code)
      expect(copy.pill.length, code).toBeGreaterThan(0)
      expect(copy.helper === null, code).toBe(code === 'connected')
    }
  })

  it('never mentions Claude’s own key prefix or console', () => {
    for (const code of CODES) {
      expect(JSON.stringify(pictureOutcomeCopy(code))).not.toMatch(/sk-ant|platform\.claude/)
    }
  })

  it('is honest that the test is free and cannot see billing', () => {
    expect(FREE_TEST_NOTE).toMatch(/free/i)
    expect(FREE_TEST_NOTE).toMatch(/billing/i)
    expect(FREE_TEST_NOTE).toMatch(/no free tier/i)
  })
})
