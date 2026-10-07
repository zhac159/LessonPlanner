import { describe, expect, it } from 'vitest'
import { passThroughJpeg, scanImageStreams } from './pdfRaw'
import { SAMPLE_JPEG } from './testJpeg'

const bytesOf = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'))

/** A tiny file with one image object around `stream` (latin1 text, so any bytes survive). */
function pdfWith(dict: string, stream: Uint8Array, number = 7): Uint8Array {
  return new Uint8Array(
    Buffer.concat([
      Buffer.from(
        `%PDF-1.4\n${number} 0 obj\n<< /Type /XObject /Subtype /Image ${dict} >>\nstream\n`,
        'latin1'
      ),
      Buffer.from(stream),
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')
    ])
  )
}

describe('scanImageStreams', () => {
  it('finds image streams by object number with their filter facts', () => {
    const found = scanImageStreams(
      pdfWith(`/Width 64 /Height 48 /Filter /DCTDecode /Length ${SAMPLE_JPEG.length}`, SAMPLE_JPEG)
    )
    const raw = found.get(7)
    expect(raw?.jpeg).toBe(true)
    expect(raw?.masked).toBe(false)
    expect(raw?.inverted).toBe(false)
    expect(Buffer.from(raw!.data).equals(Buffer.from(SAMPLE_JPEG))).toBe(true)
  })

  it('finds the end of the stream when /Length is an indirect reference or wrong', () => {
    const indirect = scanImageStreams(pdfWith('/Filter /DCTDecode /Length 9 0 R', SAMPLE_JPEG)).get(
      7
    )
    expect(indirect?.data.length).toBe(SAMPLE_JPEG.length)
    const wrong = scanImageStreams(pdfWith('/Filter /DCTDecode /Length 3', SAMPLE_JPEG)).get(7)
    expect(wrong?.data.length).toBe(SAMPLE_JPEG.length)
  })

  it('notes masks, decode arrays and other filters, and ignores non-images', () => {
    expect(
      scanImageStreams(pdfWith('/Filter /DCTDecode /SMask 9 0 R', SAMPLE_JPEG)).get(7)?.masked
    ).toBe(true)
    expect(
      scanImageStreams(pdfWith('/Filter /DCTDecode /Decode [1 0 1 0 1 0]', SAMPLE_JPEG)).get(7)
        ?.inverted
    ).toBe(true)
    expect(
      scanImageStreams(pdfWith('/Filter [/FlateDecode /DCTDecode]', SAMPLE_JPEG)).get(7)?.jpeg
    ).toBe(false)
    expect(scanImageStreams(pdfWith('/Filter [/DCTDecode]', SAMPLE_JPEG)).get(7)?.jpeg).toBe(true)
    expect(scanImageStreams(bytesOf('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj')).size).toBe(
      0
    )
  })

  it('lets a later definition of the same object win', () => {
    const first = pdfWith('/Filter /FlateDecode', new Uint8Array([1, 2, 3]))
    const second = pdfWith('/Filter /DCTDecode', SAMPLE_JPEG)
    const found = scanImageStreams(new Uint8Array(Buffer.concat([first, second])))
    expect(found.get(7)?.jpeg).toBe(true)
  })
})

describe('passThroughJpeg', () => {
  const raw = (patch = {}) => ({
    data: SAMPLE_JPEG,
    jpeg: true,
    masked: false,
    inverted: false,
    ...patch
  })

  it('returns the bare JPEG when it matches the picture', () => {
    expect(passThroughJpeg(raw(), 64, 48)?.length).toBe(SAMPLE_JPEG.length)
  })

  it('trims bytes after the end-of-image marker', () => {
    const padded = new Uint8Array([...SAMPLE_JPEG, 0, 0, 0, 0])
    expect(passThroughJpeg(raw({ data: padded }), 64, 48)?.length).toBe(SAMPLE_JPEG.length)
  })

  it('refuses masked, inverted, non-JPEG, wrongly sized, encrypted or truncated data', () => {
    expect(passThroughJpeg(undefined, 64, 48)).toBeNull()
    expect(passThroughJpeg(raw({ masked: true }), 64, 48)).toBeNull()
    expect(passThroughJpeg(raw({ inverted: true }), 64, 48)).toBeNull()
    expect(passThroughJpeg(raw({ jpeg: false }), 64, 48)).toBeNull()
    expect(passThroughJpeg(raw(), 65, 48)).toBeNull()
    expect(passThroughJpeg(raw({ data: new Uint8Array([9, 9, 9, 9]) }), 64, 48)).toBeNull()
    expect(passThroughJpeg(raw({ data: SAMPLE_JPEG.subarray(0, 300) }), 64, 48)).toBeNull()
  })

  it('refuses CMYK JPEGs, which pdf.js has to convert', () => {
    const cmyk = new Uint8Array(SAMPLE_JPEG)
    const sof = cmyk.findIndex((b, i) => b === 0xff && cmyk[i + 1] === 0xc0)
    cmyk[sof + 9] = 4
    expect(passThroughJpeg(raw({ data: cmyk }), 64, 48)).toBeNull()
  })
})
