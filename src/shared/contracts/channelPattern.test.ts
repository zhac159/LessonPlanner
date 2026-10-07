import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The channel-name rule main enforces, read from src/main/moduleBus.ts so the two cannot drift.
 * Lives in a .test.ts file (excluded from the web type-check) and is imported by the contract tests.
 */
const moduleBusSource = (): string =>
  readFileSync(new URL('../../main/moduleBus.ts', import.meta.url), 'utf8')

/** The `CHANNEL_PATTERN` regex declared in moduleBus.ts. */
export function channelPattern(): RegExp {
  const match = /CHANNEL_PATTERN\s*=\s*\/(.+)\//.exec(moduleBusSource())
  if (!match?.[1]) throw new Error('CHANNEL_PATTERN not found in src/main/moduleBus.ts')
  return new RegExp(match[1])
}

/** Names that main would refuse to register, plus duplicates. Empty when the list is sound. */
export function invalidChannels(names: readonly string[]): string[] {
  const pattern = channelPattern()
  const seen = new Set<string>()
  return names.filter((name) => {
    const bad = !pattern.test(name) || seen.has(name)
    seen.add(name)
    return bad
  })
}

describe('channelPattern', () => {
  it('accepts module-local area channels and rejects spaces or leading digits', () => {
    const pattern = channelPattern()
    expect(pattern.test('chat:send')).toBe(true)
    expect(pattern.test('gen-progress')).toBe(true)
    expect(pattern.test('bad name')).toBe(false)
    expect(pattern.test('1start')).toBe(false)
  })

  it('reports invalid and duplicate names', () => {
    expect(invalidChannels(['a', 'b:c'])).toEqual([])
    expect(invalidChannels(['a', 'a', 'no way'])).toEqual(['a', 'no way'])
  })
})
