import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultExportName, exportToFile, writeFileAtomic } from './save'
import { deckWith, loadFixtureDeck, loadFixtureStyle, openPptx, textEl } from './testkit'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'export-save-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const io = { readAsset: async () => undefined }

describe('defaultExportName', () => {
  it('uses the lesson title', () => {
    expect(defaultExportName({ title: 'Y8 Science — Photosynthesis' })).toBe(
      'Y8 Science — Photosynthesis.pptx'
    )
  })

  it('strips characters Windows forbids and collapses whitespace', () => {
    expect(defaultExportName({ title: 'Why? "Plants" <3 / acids: A|B*  ' })).toBe(
      'Why Plants 3 acids AB.pptx'
    )
    expect(defaultExportName({ title: 'a\u0000b\nc' })).toBe('ab c.pptx')
  })

  it('removes trailing dots and spaces, which Windows silently drops', () => {
    expect(defaultExportName({ title: 'Fractions...  ' })).toBe('Fractions.pptx')
  })

  it('avoids reserved device names and empty names', () => {
    expect(defaultExportName({ title: 'CON' })).toBe('CON lesson.pptx')
    expect(defaultExportName({ title: 'com1' })).toBe('com1 lesson.pptx')
    expect(defaultExportName({ title: '???' })).toBe('Lesson.pptx')
    expect(defaultExportName({ title: '' })).toBe('Lesson.pptx')
  })

  it('keeps names to a sane length', () => {
    expect(defaultExportName({ title: 'x'.repeat(500) }).length).toBeLessThanOrEqual(125)
  })
})

describe('writeFileAtomic', () => {
  it('writes the bytes, creates missing folders and leaves no temp file', async () => {
    const target = join(dir, 'nested', 'deep', 'f.bin')
    await writeFileAtomic(target, Uint8Array.from([1, 2, 3]))
    expect([...readFileSync(target)]).toEqual([1, 2, 3])
    expect(readdirSync(join(dir, 'nested', 'deep'))).toEqual(['f.bin'])
  })

  it('replaces an existing file in one step', async () => {
    const target = join(dir, 'f.bin')
    writeFileSync(target, 'old')
    await writeFileAtomic(target, Uint8Array.from([9]))
    expect([...readFileSync(target)]).toEqual([9])
  })

  it('cleans up the temp file when the rename fails', async () => {
    const target = join(dir, 'blocked')
    mkdirSync(target) // renaming a file onto a directory fails
    await expect(writeFileAtomic(target, Uint8Array.from([1]))).rejects.toThrow()
    expect(readdirSync(dir)).toEqual(['blocked'])
  })
})

describe('exportToFile', () => {
  it('writes a valid .pptx and returns the path and warnings', async () => {
    const target = join(dir, defaultExportName(loadFixtureDeck()))
    const result = await exportToFile(loadFixtureDeck(), loadFixtureStyle(), io, target)
    expect(result).toMatchObject({ ok: true, path: target, missingAssets: [] })
    if (result.ok) {
      expect(result.skippedSpots).toHaveLength(1) // the fixture's empty photo spot
      expect(result.warnings).toEqual([expect.stringContaining('picture spot')])
    }
    const file = await openPptx(new Uint8Array(readFileSync(target)))
    expect(file.slideCount).toBe(3)
    expect(readdirSync(dir)).toEqual(['Y8 Science — Photosynthesis.pptx'])
  })

  it('passes export warnings through', async () => {
    const deck = deckWith([{ ...textEl('t', 'x') }])
    deck.slides = []
    const result = await exportToFile(deck, null, io, join(dir, 'a.pptx'))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.warnings).toHaveLength(1)
  })

  it('reports an unwritable target as a failure instead of throwing', async () => {
    const target = join(dir, 'taken')
    mkdirSync(target)
    const result = await exportToFile(loadFixtureDeck(), null, io, target)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['io', 'file-locked']).toContain(result.code)
      expect(result.message.length).toBeGreaterThan(10)
    }
    expect(readdirSync(dir)).toEqual(['taken'])
  })
})
