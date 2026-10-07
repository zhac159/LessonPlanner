import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prepareSource } from './readSource'
import { makePdf, makePptx } from './testing'

let dir: string
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'readsource-'))
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const write = (name: string, bytes: Uint8Array) => {
  const path = join(dir, name)
  writeFileSync(path, bytes)
  return path
}

describe('prepareSource', () => {
  it('digests a pptx and reports slide count', async () => {
    const path = write('a.pptx', await makePptx([{ title: 'One' }, { title: 'Two' }]))
    const prepared = await prepareSource(path, 'pptx', 'Original name.pptx')
    expect(prepared.units).toBe(2)
    expect(prepared.input).toMatchObject({ kind: 'pptx', fileName: 'Original name.pptx' })
  })

  it('passes a pdf through as bytes with its page count', async () => {
    const path = write('a.pdf', makePdf(['Hello there teacher', 'Page two text']))
    const prepared = await prepareSource(path, 'pdf')
    expect(prepared.units).toBe(2)
    expect(prepared.input.kind === 'pdf' && prepared.input.pdf.byteLength).toBeGreaterThan(100)
    expect(prepared.input.fileName).toBe('a.pdf')
  })

  it('surfaces import failures and missing files', async () => {
    await expect(prepareSource(write('b.pdf', makePdf([''])), 'pdf')).rejects.toMatchObject({
      code: 'scanned'
    })
    await expect(prepareSource(write('b.pptx', Buffer.from('x')), 'pptx')).rejects.toMatchObject({
      code: 'corrupt'
    })
    await expect(prepareSource(join(dir, 'nope.pdf'), 'pdf')).rejects.toMatchObject({
      code: 'missing'
    })
  })
})
