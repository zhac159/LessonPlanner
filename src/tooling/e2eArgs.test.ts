import { describe, expect, it } from 'vitest'
import {
  briefError,
  cleanElectronEnv,
  defaultShotName,
  formatFlowLine,
  parseRunArgs,
  parseShotArgs,
  parseSize
} from '../../scripts/e2e/args.mjs'

/** Unit tests for the pure helpers behind scripts/e2e/run.mjs and scripts/shot.mjs. */
describe('parseRunArgs', () => {
  it('defaults to every flow, the dev build and a two minute timeout', () => {
    expect(parseRunArgs([])).toEqual({ only: null, exe: null, timeoutSeconds: 120, list: false })
  })

  it('reads --only, --exe, --timeout and --list', () => {
    const args = parseRunArgs(['--only', 'start', '--exe', 'a b.exe', '--timeout', '30', '--list'])
    expect(args).toEqual({ only: 'start', exe: 'a b.exe', timeoutSeconds: 30, list: true })
  })

  it('rejects a missing value, a bad timeout and stray arguments', () => {
    expect(() => parseRunArgs(['--only'])).toThrow('--only needs a value')
    expect(() => parseRunArgs(['--only', '--list'])).toThrow('needs a value')
    expect(() => parseRunArgs(['--timeout', 'soon'])).toThrow('positive number')
    expect(() => parseRunArgs(['--timeout', '0'])).toThrow('positive number')
    expect(() => parseRunArgs(['startup'])).toThrow('Unexpected argument "startup"')
  })
})

describe('parseSize', () => {
  it('parses WxH in either case', () => {
    expect(parseSize('1440x900')).toEqual({ width: 1440, height: 900 })
    expect(parseSize('1280X800')).toEqual({ width: 1280, height: 800 })
  })

  it('rejects anything else', () => {
    for (const bad of ['1440', '1440x', 'x900', '14x9', '1440 x 900', 'wide']) {
      expect(() => parseSize(bad)).toThrow('--size must look like')
    }
  })
})

describe('parseShotArgs', () => {
  it('needs a module id and applies the design-image width by default', () => {
    expect(() => parseShotArgs([])).toThrow('Usage')
    expect(parseShotArgs(['home'])).toEqual({
      moduleId: 'home',
      intent: undefined,
      seed: null,
      size: { width: 1440, height: 900 },
      name: 'home',
      exe: null
    })
  })

  it('parses intent JSON, seed, size, name and exe', () => {
    const args = parseShotArgs([
      'deck-builder',
      '--intent',
      '{"lessonId":"dck_1"}',
      '--seed',
      'two-lessons',
      '--size',
      '1440x940',
      '--name',
      'editor.png',
      '--exe',
      'x.exe'
    ])
    expect(args).toEqual({
      moduleId: 'deck-builder',
      intent: { lessonId: 'dck_1' },
      seed: 'two-lessons',
      size: { width: 1440, height: 940 },
      name: 'editor',
      exe: 'x.exe'
    })
  })

  it('names the file after the module and seed when no name is given', () => {
    expect(parseShotArgs(['home', '--seed', 'empty']).name).toBe('home-empty')
  })

  it('rejects invalid intent JSON and extra positional arguments', () => {
    expect(() => parseShotArgs(['home', '--intent', '{bad'])).toThrow('--intent must be JSON')
    expect(() => parseShotArgs(['home', 'settings'])).toThrow('Unexpected argument "settings"')
  })
})

describe('defaultShotName', () => {
  it('joins module and seed and strips unsafe characters', () => {
    expect(defaultShotName('home')).toBe('home')
    expect(defaultShotName('style-library', 'a/b c')).toBe('style-library-a_b_c')
  })
})

describe('formatFlowLine', () => {
  it('prints status, name, seconds and the check count', () => {
    expect(formatFlowLine('startup', true, 7.234, 10)).toBe('PASS  startup  7.2s  (10 checks)')
    expect(formatFlowLine('startup', false, 0.4, 0)).toBe('FAIL  startup  0.4s')
  })
})

describe('cleanElectronEnv', () => {
  it('drops ELECTRON_RUN_AS_NODE and keeps everything else', () => {
    const env = cleanElectronEnv({ ELECTRON_RUN_AS_NODE: '1', PATH: 'x', EMPTY: undefined })
    expect(env).toEqual({ PATH: 'x', EMPTY: undefined })
    expect('ELECTRON_RUN_AS_NODE' in env).toBe(false)
  })
})

describe('briefError', () => {
  it('keeps short errors whole and trims long ones to the first lines', () => {
    expect(briefError(new Error('boom'))).toBe('boom')
    expect(briefError('plain text')).toBe('plain text')
    const long = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n')
    const brief = briefError(new Error(long), 3)
    expect(brief).toBe('line 1\nline 2\nline 3\n… (7 more lines)')
  })

  it('ignores blank lines', () => {
    expect(briefError(new Error('a\n\n  \nb'))).toBe('a\nb')
  })
})
