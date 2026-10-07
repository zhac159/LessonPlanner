import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appendJsonl, appendLine, atomicWriteJson, ensureDir, readJsonSafe } from './fsx'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fsx-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('atomicWriteJson', () => {
  it('creates parent folders and writes readable JSON', async () => {
    const file = join(dir, 'a', 'b', 'x.json')
    await atomicWriteJson(file, { n: 1, s: 'é' })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ n: 1, s: 'é' })
  })

  it('overwrites an existing file and leaves no temp files behind', async () => {
    const file = join(dir, 'x.json')
    await atomicWriteJson(file, { v: 1 })
    await atomicWriteJson(file, { v: 2 })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ v: 2 })
    expect(readdirSync(dir)).toEqual(['x.json'])
  })

  it('survives many concurrent writes to the same file', async () => {
    const file = join(dir, 'x.json')
    await Promise.all(Array.from({ length: 12 }, (_, i) => atomicWriteJson(file, { i })))
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { i: number }
    expect(parsed.i).toBeGreaterThanOrEqual(0)
    expect(readdirSync(dir)).toEqual(['x.json'])
  })

  it('cleans up the temp file and rethrows when the value cannot be serialised', async () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    await expect(atomicWriteJson(join(dir, 'x.json'), cyclic)).rejects.toThrow()
    expect(readdirSync(dir)).toEqual([])
  })
})

describe('atomicWriteJson clean-up', () => {
  it('removes its temp file and rethrows when the rename fails', async () => {
    const target = join(dir, 'x.json')
    mkdirSync(join(target, 'inside'), { recursive: true }) // a folder cannot be replaced by a file
    await expect(atomicWriteJson(target, { v: 1 })).rejects.toThrow()
    expect(readdirSync(dir)).toEqual(['x.json'])
  })

  it('sweeps temp files left by a crashed write, but not fresh ones or other files', async () => {
    const file = join(dir, 'x.json')
    const stale = `${file}.deadbeef.tmp`
    const fresh = `${file}.cafebabe.tmp`
    const other = join(dir, 'y.json.deadbeef.tmp')
    for (const path of [stale, fresh, other]) writeFileSync(path, '{')
    const old = new Date(Date.now() - 10 * 60_000)
    utimesSync(stale, old, old)
    utimesSync(other, old, old)
    await atomicWriteJson(file, { v: 1 })
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(fresh)).toBe(true) // might belong to a write that is still running
    expect(existsSync(other)).toBe(true) // another file's temp is none of our business
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ v: 1 })
  })
})

describe('readJsonSafe', () => {
  it('returns undefined for missing and corrupt files', async () => {
    expect(await readJsonSafe(join(dir, 'nope.json'))).toBeUndefined()
    writeFileSync(join(dir, 'bad.json'), '{ not json')
    expect(await readJsonSafe(join(dir, 'bad.json'))).toBeUndefined()
  })

  it('returns parsed data, and undefined when the parser rejects it', async () => {
    const file = join(dir, 'x.json')
    await atomicWriteJson(file, { n: 5 })
    expect(await readJsonSafe<{ n: number }>(file)).toEqual({ n: 5 })
    const strict = (raw: unknown) => {
      if (typeof raw !== 'object' || raw === null || !('m' in raw)) throw new Error('bad')
      return raw
    }
    expect(await readJsonSafe(file, strict)).toBeUndefined()
  })
})

describe('appendJsonl', () => {
  it('appends one line per call, creating the file', async () => {
    const file = join(dir, 'logs', 'x.jsonl')
    await appendJsonl(file, { a: 1 })
    await appendJsonl(file, { a: 2 })
    const lines = readFileSync(file, 'utf8').trim().split('\n')
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ a: 1 }, { a: 2 }])
  })
})

describe('appendJsonl after a torn write', () => {
  it('starts on a new line when the file does not end with a newline', async () => {
    const file = join(dir, 'torn.jsonl')
    writeFileSync(file, `${JSON.stringify({ a: 1 })}\n{"a":2,"half`)
    await appendJsonl(file, { a: 3 })
    const lines = readFileSync(file, 'utf8').split('\n')
    expect(lines).toEqual([JSON.stringify({ a: 1 }), '{"a":2,"half', JSON.stringify({ a: 3 }), ''])
    const good = lines.filter(Boolean).flatMap((l) => {
      try {
        return [JSON.parse(l)]
      } catch {
        return [] // what every reader does with a damaged line
      }
    })
    expect(good).toEqual([{ a: 1 }, { a: 3 }])
  })

  it('adds no blank line when the file already ends with one', async () => {
    const file = join(dir, 'ok.jsonl')
    await appendLine(file, 'one')
    await appendLine(file, 'two')
    expect(readFileSync(file, 'utf8')).toBe('one\ntwo\n')
  })

  it('treats an empty existing file like a new one', async () => {
    const file = join(dir, 'empty.jsonl')
    writeFileSync(file, '')
    await appendLine(file, 'one')
    expect(readFileSync(file, 'utf8')).toBe('one\n')
  })
})

describe('ensureDir', () => {
  it('is idempotent', async () => {
    await ensureDir(join(dir, 'a', 'b'))
    await ensureDir(join(dir, 'a', 'b'))
    expect(readdirSync(join(dir, 'a'))).toEqual(['b'])
  })
})
