import { describe, expect, it } from 'vitest'
import { readPdfInfo } from './pdfInfo'
import { makePdf } from './testing'

describe('readPdfInfo', () => {
  it('counts pages and extracts text per page', async () => {
    const info = await readPdfInfo(makePdf(['Photosynthesis lesson', 'Key words: chlorophyll']))
    expect(info.pages).toBe(2)
    expect(info.pageText[0]).toContain('Photosynthesis lesson')
    expect(info.pageText[1]).toContain('chlorophyll')
    expect(info.mayContainNames).toBe(false)
  })

  it('does not consume the caller’s buffer', async () => {
    const bytes = makePdf(['Some readable text here'])
    await readPdfInfo(bytes)
    expect(bytes.byteLength).toBeGreaterThan(0)
    await expect(readPdfInfo(bytes)).resolves.toMatchObject({ pages: 1 })
  })

  it('flags personal data in the text', async () => {
    const info = await readPdfInfo(makePdf(['Contact mr.jones@school.org.uk for the register']))
    expect(info.mayContainNames).toBe(true)
  })

  it('reports PDFs with no text as scanned images', async () => {
    await expect(readPdfInfo(makePdf(['', '']))).rejects.toMatchObject({
      code: 'scanned',
      message: 'This PDF is scanned images only'
    })
  })

  it('reports encrypted PDFs as password protected', async () => {
    await expect(
      readPdfInfo(makePdf(['Secret text here please'], { encrypted: true }))
    ).rejects.toMatchObject({
      code: 'password',
      message: 'Password protected'
    })
  })

  it('reports garbage as damaged', async () => {
    await expect(readPdfInfo(Buffer.from('definitely not a pdf'))).rejects.toMatchObject({
      code: 'corrupt',
      message: 'This file is damaged'
    })
    await expect(readPdfInfo(new Uint8Array())).rejects.toMatchObject({ code: 'corrupt' })
  })
})
