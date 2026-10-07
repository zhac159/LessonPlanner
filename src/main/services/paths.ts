/**
 * Where the app keeps its data. Everything lives in ONE folder (the "data root") so the app can be
 * copied or backed up as a unit and never touches a cloud or a user profile.
 *
 * `resolveDataRoot` is pure (unit-tested); `setDataRoot` / `dataRoot` / `moduleDataDir` hold the
 * resolved value for the rest of the main process. This file never imports `electron`, so services
 * that call `dataRoot()` stay unit-testable in plain Node.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { APP_CONFIG } from '@shared/appConfig'

export const DATA_DIR_ENV = 'SLIDE_PLANNER_DATA_DIR'

export interface DataRootInput {
  env: Readonly<Record<string, string | undefined>>
  /** Value of the `--user-data-dir` command-line switch, '' or undefined when absent. */
  userDataSwitch?: string
  isPackaged: boolean
  /** `process.execPath`: the .exe when packaged. */
  execPath: string
  /** `app.getAppPath()`: the repo folder in development. */
  appPath: string
}

/** Order: $SLIDE_PLANNER_DATA_DIR, `--user-data-dir`, `<folder of the exe>/data` when packaged, else `<repo>/data`. */
export function resolveDataRoot({
  env,
  userDataSwitch,
  isPackaged,
  execPath,
  appPath
}: DataRootInput): string {
  const fromEnv = env[DATA_DIR_ENV]?.trim()
  if (fromEnv) return resolve(fromEnv)
  const fromSwitch = userDataSwitch?.trim()
  if (fromSwitch) return resolve(fromSwitch)
  return isPackaged ? join(dirname(execPath), 'data') : join(appPath, 'data')
}

/** The file operations `ensureDataRoot` needs; tests inject failing ones. */
export interface RootFs {
  /** Creates the folder and its parents (no error when it exists). */
  mkdir(path: string): void
  /** Throws unless a file can be created (and removed) inside the folder. */
  probeWrite(path: string): void
}

export const nodeRootFs: RootFs = {
  mkdir: (path) => void mkdirSync(path, { recursive: true }),
  probeWrite: (path) => {
    // A folder that exists can still be read-only (Program Files): only a real write proves it.
    const probe = join(path, `.write-test-${process.pid}`)
    writeFileSync(probe, 'ok')
    rmSync(probe, { force: true })
  }
}

/** Where the lessons go when the wanted folder is not writable: `%LOCALAPPDATA%\Slide Planner\data`. */
export function fallbackDataRoot(
  env: Readonly<Record<string, string | undefined>>,
  homeDir: string
): string {
  const base = env.LOCALAPPDATA?.trim() || join(homeDir, 'AppData', 'Local')
  return join(base, APP_CONFIG.appName, 'data')
}

/** The folder is unusable and so is the fallback (or the folder was chosen explicitly): startup cannot go on. */
export class DataFolderError extends Error {
  constructor(
    /** The folder the app could not use. */
    readonly folder: string,
    readonly reason: string,
    /** True when the folder was chosen with SLIDE_PLANNER_DATA_DIR or --user-data-dir (never replaced silently). */
    readonly explicit: boolean
  ) {
    super(`Cannot use the data folder ${folder}: ${reason}`)
    this.name = 'DataFolderError'
  }
}

export interface DataRootChoice {
  root: string
  /** Set when the wanted folder could not be used and `root` is the per-user fallback instead. */
  fallbackFrom?: string
  /** Why the wanted folder was refused (technical text for the "Show details" part of the dialog). */
  problem?: string
}

const reasonOf = (error: unknown): string => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  const text = error instanceof Error ? error.message : String(error)
  return code && !text.includes(code) ? `${code}: ${text}` : text
}

function tryPrepare(fs: RootFs, folder: string): string | undefined {
  try {
    fs.mkdir(folder)
    fs.probeWrite(folder)
    return undefined
  } catch (error) {
    return reasonOf(error)
  }
}

/**
 * Makes sure the data folder exists and can be written to. When the default folder (next to the exe, or the repo
 * in development) cannot be used, for instance after an install into Program Files, the per-user fallback is
 * used instead and the outcome says so. A folder chosen explicitly (env / switch) is never replaced: that is a
 * `DataFolderError`, as is a fallback that fails too.
 */
export function ensureDataRoot(
  input: DataRootInput & { homeDir: string; fs?: RootFs }
): DataRootChoice {
  const fs = input.fs ?? nodeRootFs
  const wanted = resolveDataRoot(input)
  const problem = tryPrepare(fs, wanted)
  if (!problem) return { root: wanted }
  const explicit = Boolean(input.env[DATA_DIR_ENV]?.trim() || input.userDataSwitch?.trim())
  if (explicit) throw new DataFolderError(wanted, problem, true)
  const fallback = resolve(fallbackDataRoot(input.env, input.homeDir))
  const fallbackProblem = fallback === wanted ? problem : tryPrepare(fs, fallback)
  if (fallbackProblem)
    throw new DataFolderError(wanted, `${problem}; ${fallback}: ${fallbackProblem}`, false)
  return { root: fallback, fallbackFrom: wanted, problem }
}

let root: string | undefined
let fallbackFrom: string | undefined

/** Remember the resolved root (called once at startup, before anything reads it) and create the folder. */
export function setDataRoot(path: string, replaced?: string): string {
  mkdirSync(path, { recursive: true })
  root = path
  fallbackFrom = replaced
  return path
}

/** The data root when it has been set, else undefined (for code that must not throw, such as app info). */
export function dataRootIfSet(): string | undefined {
  return root
}

/** The folder the app wanted to use but could not (read-only install), when `dataRoot()` is the fallback. */
export function dataRootFallbackFrom(): string | undefined {
  return fallbackFrom
}

/** The data root. Throws if startup has not called `setDataRoot` yet (a programming error). */
export function dataRoot(): string {
  if (!root) throw new Error('The data root has not been set up yet')
  return root
}

/** A module's private folder, `<dataRoot>/modules/<id>`, created on demand. */
export function moduleDataDir(moduleId: string): string {
  const dir = join(dataRoot(), 'modules', moduleId)
  mkdirSync(dir, { recursive: true })
  return dir
}
