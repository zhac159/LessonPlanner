/**
 * Tiny, stable file helpers shared by every main-process store (styles, lessons, settings…).
 * Writes are atomic (temp file + rename) so a crash or power cut never leaves half a JSON file.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/** Creates `dir` (and parents) if missing. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

const RENAME_RETRIES = 4

/** `rename` over an existing file can fail briefly on Windows (antivirus/indexer); retry a few times. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!transient || attempt >= RENAME_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, 15 * (attempt + 1)))
    }
  }
}

/** Temp files this old belong to a write that died (a crash between write and rename), not to a running one. */
const STALE_TEMP_MS = 60_000
const sweptFiles = new Set<string>()

const isTempOf = (name: string, prefix: string): boolean =>
  name.startsWith(prefix) && /^[0-9a-f]{8}\.tmp$/.test(name.slice(prefix.length))

/** Removes leftover `<file>.<8 hex>.tmp` files of earlier crashed writes; best effort, once per file per run. */
async function sweepStaleTemps(file: string): Promise<void> {
  if (sweptFiles.has(file)) return
  sweptFiles.add(file)
  const prefix = `${basename(file)}.`
  try {
    for (const name of await readdir(dirname(file))) {
      if (!isTempOf(name, prefix)) continue
      const path = join(dirname(file), name)
      const age = Date.now() - (await stat(path)).mtimeMs
      if (age > STALE_TEMP_MS) await rm(path, { force: true })
    }
  } catch {
    // Cleaning up is a courtesy: never let it fail a save.
  }
}

/** Writes `value` as pretty JSON to `file` atomically; creates parent folders. */
export async function atomicWriteJson(file: string, value: unknown): Promise<void> {
  await ensureDir(dirname(file))
  await sweepStaleTemps(file)
  const temp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
    await renameWithRetry(temp, file)
  } catch (error) {
    // A failed clean-up must not hide the error that matters (the save itself failed).
    await rm(temp, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * Reads JSON, returning `undefined` when the file is missing, unreadable, not JSON, or rejected by `parse`
 * (which should throw on invalid data, e.g. a zod `.parse`). Never throws.
 */
export async function readJsonSafe<T = unknown>(
  file: string,
  parse?: (raw: unknown) => T
): Promise<T | undefined> {
  try {
    const raw: unknown = JSON.parse(await readFile(file, 'utf8'))
    return parse ? parse(raw) : (raw as T)
  } catch {
    return undefined
  }
}

/**
 * Appends `line` plus a newline. When the file does not end with a newline (a crash tore the previous write in
 * half) a newline goes first, so the damaged line stays alone (readers skip it) and this one is not lost with it.
 */
export async function appendLine(file: string, line: string): Promise<void> {
  await ensureDir(dirname(file))
  const handle = await open(file, 'a+')
  try {
    const { size } = await handle.stat()
    let prefix = ''
    if (size > 0) {
      const last = Buffer.alloc(1)
      await handle.read(last, 0, 1, size - 1)
      if (last[0] !== 0x0a) prefix = '\n'
    }
    await handle.appendFile(`${prefix}${line}\n`, 'utf8')
  } finally {
    await handle.close()
  }
}

/** Appends one JSON value as a line to a `.jsonl` file (creates it and its folder when missing). */
export async function appendJsonl(file: string, value: unknown): Promise<void> {
  await appendLine(file, JSON.stringify(value))
}
