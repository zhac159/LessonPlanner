/** Which fonts are installed on this PC, so the export can warn before PowerPoint substitutes one. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const FONT_KEYS = [
  'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
  'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
]

/** Runs `reg query` and returns its text; injectable so tests need no registry. */
export type RegistryQuery = (key: string) => Promise<string>

const queryRegistry: RegistryQuery = async (key) =>
  (await run('reg', ['query', key], { timeout: 8000, windowsHide: true })).stdout

/**
 * Parses `reg query` output into lower-case font names. Value names look like
 * `Calibri Bold (TrueType)` or `Cambria & Cambria Math (TrueType)`.
 */
export function parseFontRegistry(output: string): Set<string> {
  const names = new Set<string>()
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s+(.+?)\s+REG_(?:SZ|EXPAND_SZ)\s/.exec(line)
    if (!match) continue
    const bare = match[1].replace(/\s*\((?:TrueType|OpenType|All res)\)\s*$/i, '')
    for (const name of bare.split(' & ')) names.add(name.trim().toLowerCase())
  }
  return names
}

/** True when `family` is installed: an exact name, or a style of it ("Lexend Bold" for "Lexend"). */
export function isFontInstalled(installed: ReadonlySet<string>, family: string): boolean {
  const wanted = family.trim().toLowerCase()
  if (installed.has(wanted)) return true
  for (const name of installed) if (name.startsWith(`${wanted} `)) return true
  return false
}

/**
 * Reads the installed font names from the Windows registry (machine and per-user installs).
 * Returns `undefined` off Windows or when the registry cannot be read, meaning "unknown".
 */
export async function readInstalledFonts(
  platform: string = process.platform,
  query: RegistryQuery = queryRegistry
): Promise<Set<string> | undefined> {
  if (platform !== 'win32') return undefined
  const outputs = await Promise.all(FONT_KEYS.map((key) => query(key).catch(() => undefined)))
  const all = new Set<string>()
  for (const output of outputs)
    if (output) for (const name of parseFontRegistry(output)) all.add(name)
  return all.size > 0 ? all : undefined
}
