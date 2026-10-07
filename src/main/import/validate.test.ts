import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashFile, MAX_FILE_BYTES, MAX_FILES_PER_STYLE, validateFiles } from './validate'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'validate-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const file = (name: string, content: string | Buffer = name) => {
  const path = join(dir, name)
  writeFileSync(path, content)
  return path
}
const none = { existingHashes: new Set<string>(), existingCount: 0 }

describe('validateFiles', () => {
  it('accepts pdf and pptx (any case) and reports kind, size and hash', async () => {
    const { accepted, rejected } = await validateFiles(
      [file('a.pdf', 'x'), file('B.PPTX', 'yy')],
      none
    )
    expect(rejected).toEqual([])
    expect(accepted.map((f) => [f.fileName, f.kind, f.size])).toEqual([
      ['a.pdf', 'pdf', 1],
      ['B.PPTX', 'pptx', 2]
    ])
    expect(accepted[0].hash).toBe(await hashFile(accepted[0].path))
  })

  it('sorts a batch by file name, numerically (Lesson 2 before Lesson 10)', async () => {
    const paths = ['Lesson 10.pdf', 'lesson 2.pdf', 'Lesson 1.pdf'].map((n) => file(n))
    const { accepted } = await validateFiles(paths, none)
    expect(accepted.map((f) => f.fileName)).toEqual([
      'Lesson 1.pdf',
      'lesson 2.pdf',
      'Lesson 10.pdf'
    ])
  })

  it('tells her to save old .ppt files as .pptx', async () => {
    const { rejected } = await validateFiles([file('old.PPT')], none)
    expect(rejected).toMatchObject([{ code: 'old-ppt', reason: expect.stringContaining('.pptx') }])
  })

  it('rejects other extensions with a readable reason', async () => {
    const { accepted, rejected } = await validateFiles([file('notes.docx'), file('noext')], none)
    expect(accepted).toEqual([])
    expect(rejected.map((r) => [r.fileName, r.code, r.reason])).toEqual([
      ['noext', 'unsupported', 'Only PDF and PowerPoint files'],
      ['notes.docx', 'unsupported', 'Only PDF and PowerPoint files']
    ])
  })

  it('rejects missing files and folders', async () => {
    const { rejected } = await validateFiles([join(dir, 'gone.pdf'), dir + '/sub.pdf'], none)
    expect(rejected.map((r) => r.code)).toEqual(['missing', 'missing'])
  })

  it('rejects files over 50 MB without reading them', async () => {
    const path = file('big.pdf', '')
    truncateSync(path, MAX_FILE_BYTES + 1) // sparse file
    const { accepted, rejected } = await validateFiles([path], none)
    expect(accepted).toEqual([])
    expect(rejected[0]).toMatchObject({ code: 'too-large', reason: 'Over 50 MB' })
  })

  it('accepts a file of exactly 50 MB', async () => {
    // A tiny limit exercises the same boundary without writing 50 MB.
    const path = file('edge.pdf', 'x'.repeat(2048))
    expect((await validateFiles([path], { ...none, maxFileBytes: 2048 })).accepted).toHaveLength(1)
    expect((await validateFiles([path], { ...none, maxFileBytes: 2047 })).rejected[0]?.code).toBe(
      'too-large'
    )
  })

  it('dedupes by content against existing files and within the batch', async () => {
    const same1 = file('one.pdf', 'same bytes')
    const same2 = file('two.pdf', 'same bytes')
    const other = file('three.pdf', 'different')
    const existing = await hashFile(other)
    const { accepted, rejected } = await validateFiles([same1, same2, other], {
      existingHashes: new Set([existing]),
      existingCount: 1
    })
    expect(accepted.map((f) => f.fileName)).toEqual(['one.pdf'])
    expect(rejected.map((r) => [r.fileName, r.code])).toEqual([
      ['three.pdf', 'duplicate'],
      ['two.pdf', 'duplicate']
    ])
  })

  it('enforces the 50 files per style limit including existing files', async () => {
    const paths = ['a.pdf', 'b.pdf', 'c.pdf'].map((n) => file(n))
    const { accepted, rejected } = await validateFiles(paths, {
      existingHashes: new Set(),
      existingCount: MAX_FILES_PER_STYLE - 2
    })
    expect(accepted.map((f) => f.fileName)).toEqual(['a.pdf', 'b.pdf'])
    expect(rejected).toMatchObject([{ fileName: 'c.pdf', code: 'too-many' }])
  })
})
