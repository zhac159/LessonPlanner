import { describe, expect, it } from 'vitest'
import { ADMIN_KEY, NOT_A_KEY, lastFourOf, normaliseApiKey, redactApiKeys } from './keyFormat'

describe('normaliseApiKey', () => {
  it('trims and strips inner whitespace', () => {
    expect(normaliseApiKey('  sk-ant-api03-ab\n cd  ')).toEqual({
      ok: true,
      key: 'sk-ant-api03-abcd'
    })
  })

  it('rejects anything without the sk-ant- prefix', () => {
    expect(normaliseApiKey('hello')).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: NOT_A_KEY
    })
    expect(normaliseApiKey('')).toMatchObject({ ok: false, message: NOT_A_KEY })
    expect(normaliseApiKey('sk-ant-')).toMatchObject({ ok: false, message: NOT_A_KEY })
  })

  it('rejects admin keys with their own message', () => {
    expect(normaliseApiKey('sk-ant-admin01-xyz')).toMatchObject({ ok: false, message: ADMIN_KEY })
  })

  it('exposes only the last four characters', () => {
    expect(lastFourOf('sk-ant-api03-WXYZ')).toBe('WXYZ')
  })
})

describe('redactApiKeys', () => {
  it('hides every key-like token in a string', () => {
    const text = 'Bad key sk-ant-api03-SECRET123 and also sk-ant-admin01-OTHER_9 here'
    const out = redactApiKeys(text)
    expect(out).not.toContain('SECRET123')
    expect(out).not.toContain('OTHER_9')
    expect(out).toBe('Bad key sk-ant-… and also sk-ant-… here')
  })

  it('leaves other text alone', () => {
    expect(redactApiKeys('nothing to see')).toBe('nothing to see')
  })
})
