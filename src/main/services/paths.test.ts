import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  dataRoot,
  dataRootFallbackFrom,
  DataFolderError,
  ensureDataRoot,
  fallbackDataRoot,
  moduleDataDir,
  nodeRootFs,
  resolveDataRoot,
  setDataRoot,
  type DataRootInput,
  type RootFs
} from './paths'

const base: DataRootInput = {
  env: {},
  isPackaged: false,
  execPath: join('C:', 'Apps', 'Slide Planner', 'Slide Planner.exe'),
  appPath: join('C:', 'repo')
}

describe('resolveDataRoot', () => {
  it('uses <repo>/data in development', () => {
    expect(resolveDataRoot(base)).toBe(join('C:', 'repo', 'data'))
  })

  it('uses <folder of the exe>/data when packaged', () => {
    expect(resolveDataRoot({ ...base, isPackaged: true })).toBe(
      join('C:', 'Apps', 'Slide Planner', 'data')
    )
  })

  it('prefers the --user-data-dir switch over the defaults', () => {
    const input = { ...base, isPackaged: true, userDataSwitch: join('D:', 'tmp', 'profile') }
    expect(resolveDataRoot(input)).toBe(resolve('D:', 'tmp', 'profile'))
  })

  it('prefers $SLIDE_PLANNER_DATA_DIR over everything', () => {
    const input = {
      ...base,
      env: { SLIDE_PLANNER_DATA_DIR: join('E:', 'mine') },
      userDataSwitch: join('D:', 'tmp')
    }
    expect(resolveDataRoot(input)).toBe(resolve('E:', 'mine'))
  })

  it('ignores empty or blank overrides', () => {
    const input = { ...base, env: { SLIDE_PLANNER_DATA_DIR: '  ' }, userDataSwitch: '' }
    expect(resolveDataRoot(input)).toBe(join('C:', 'repo', 'data'))
  })

  it('makes a relative override absolute', () => {
    const input = { ...base, env: { SLIDE_PLANNER_DATA_DIR: 'relative-data' } }
    expect(resolveDataRoot(input)).toBe(resolve('relative-data'))
  })
})

const made: string[] = []
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const home = join('C:', 'Users', 'teacher')
const localAppData = join('C:', 'Users', 'teacher', 'AppData', 'Local')
const packaged = { ...base, isPackaged: true, env: { LOCALAPPDATA: localAppData }, homeDir: home }
const installDir = join('C:', 'Apps', 'Slide Planner', 'data')
const fallbackDir = join(localAppData, 'Slide Planner', 'data')

/** A fake file system: the listed folders cannot be created (mkdir) or written to (probe). */
function fakeFs(options: { noMkdir?: string[]; noWrite?: string[] }): RootFs & { made: string[] } {
  const made: string[] = []
  const denied = (code: string): Error =>
    Object.assign(new Error(`${code}: permission denied`), { code })
  return {
    made,
    mkdir: (path) => {
      if (options.noMkdir?.includes(path)) throw denied('EACCES')
      made.push(path)
    },
    probeWrite: (path) => {
      if (options.noWrite?.includes(path)) throw denied('EPERM')
    }
  }
}

describe('ensureDataRoot', () => {
  it('keeps the wanted folder when it can be written to', () => {
    const fs = fakeFs({})
    expect(ensureDataRoot({ ...packaged, fs })).toEqual({ root: installDir })
    expect(fs.made).toEqual([installDir])
  })

  it('falls back to %LOCALAPPDATA%\Slide Planner\data when the folder cannot be created', () => {
    const fs = fakeFs({ noMkdir: [installDir] })
    const choice = ensureDataRoot({ ...packaged, fs })
    expect(choice.root).toBe(fallbackDir)
    expect(choice.fallbackFrom).toBe(installDir)
    expect(choice.problem).toContain('EACCES')
    expect(fs.made).toEqual([fallbackDir])
  })

  it('falls back when the folder exists but is read-only', () => {
    const fs = fakeFs({ noWrite: [installDir] })
    expect(ensureDataRoot({ ...packaged, fs })).toMatchObject({
      root: fallbackDir,
      fallbackFrom: installDir,
      problem: expect.stringContaining('EPERM')
    })
  })

  it('uses the profile folder when LOCALAPPDATA is not set', () => {
    expect(fallbackDataRoot({}, home)).toBe(join(home, 'AppData', 'Local', 'Slide Planner', 'data'))
    expect(fallbackDataRoot({ LOCALAPPDATA: ' ' }, home)).toBe(
      join(home, 'AppData', 'Local', 'Slide Planner', 'data')
    )
  })

  it('throws when the fallback cannot be used either, naming the wanted folder', () => {
    const fs = fakeFs({ noMkdir: [installDir, fallbackDir] })
    const error = (() => {
      try {
        ensureDataRoot({ ...packaged, fs })
      } catch (e) {
        return e
      }
    })() as DataFolderError
    expect(error).toBeInstanceOf(DataFolderError)
    expect(error.folder).toBe(installDir)
    expect(error.explicit).toBe(false)
    expect(error.reason).toContain(fallbackDir)
  })

  it('never replaces a folder chosen with SLIDE_PLANNER_DATA_DIR or --user-data-dir', () => {
    const chosen = resolve('E:', 'mine')
    const viaEnv = { ...packaged, env: { ...packaged.env, SLIDE_PLANNER_DATA_DIR: chosen } }
    expect(() => ensureDataRoot({ ...viaEnv, fs: fakeFs({ noMkdir: [chosen] }) })).toThrow(
      DataFolderError
    )
    const switched = { ...packaged, userDataSwitch: chosen }
    expect(() => ensureDataRoot({ ...switched, fs: fakeFs({ noWrite: [chosen] }) })).toThrow(
      expect.objectContaining({ explicit: true, folder: chosen })
    )
  })

  it('works on the real file system: a folder below a plain file cannot be created', () => {
    const parent = mkdtempSync(join(tmpdir(), 'sp-root-'))
    made.push(parent)
    const blocker = join(parent, 'file.txt')
    writeFileSync(blocker, 'x')
    const wanted = join(blocker, 'data')
    expect(() => nodeRootFs.mkdir(wanted)).toThrow()
    const choice = ensureDataRoot({
      ...base,
      env: { LOCALAPPDATA: join(parent, 'local') },
      appPath: blocker,
      homeDir: parent
    })
    expect(choice.root).toBe(join(parent, 'local', 'Slide Planner', 'data'))
    expect(choice.fallbackFrom).toBe(wanted)
    expect(existsSync(choice.root)).toBe(true)
  })
})

describe('data root state', () => {
  it('throws while the root has not been set', () => {
    expect(() => dataRoot()).toThrow(/not been set/)
  })

  it('creates the root and per-module folders on demand', () => {
    const parent = mkdtempSync(join(tmpdir(), 'sp-paths-'))
    made.push(parent)
    const target = join(parent, 'nested', 'data')
    setDataRoot(target)
    expect(existsSync(target)).toBe(true)
    expect(dataRoot()).toBe(target)
    expect(dataRootFallbackFrom()).toBeUndefined()
    setDataRoot(target, 'C:\wanted')
    expect(dataRootFallbackFrom()).toBe('C:\wanted')

    const dir = moduleDataDir('deck-builder')
    expect(dir).toBe(join(target, 'modules', 'deck-builder'))
    expect(existsSync(dir)).toBe(true)
  })
})
