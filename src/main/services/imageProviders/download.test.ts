import { describe, expect, it } from 'vitest'
import { assertSafeUrl, downloadImage, sniffImage } from './download'
import { GIF, JPEG, PNG, SVG, WEBP, bytesResponse, fakeFetch, text } from './testing'

const URL1 = 'https://upload.example.org/a.jpg'

describe('sniffImage', () => {
  it('decides by the bytes', () => {
    expect(sniffImage(PNG)).toBe('image/png')
    expect(sniffImage(JPEG)).toBe('image/jpeg')
    expect(sniffImage(GIF)).toBe('image/gif')
    expect(sniffImage(WEBP)).toBe('image/webp')
    expect(sniffImage(SVG)).toBe('image/svg+xml')
    expect(
      sniffImage(
        new TextEncoder().encode(
          '\uFEFF<?xml version="1.0"?>\n<!-- c -->\n<svg viewBox="0 0 1 1"/>'
        )
      )
    ).toBe('image/svg+xml')
    expect(sniffImage(new TextEncoder().encode('<html><svg></svg></html>'))).toBeNull()
    expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(sniffImage(new Uint8Array())).toBeNull()
  })
})

describe('assertSafeUrl', () => {
  it('accepts public https and refuses everything else', () => {
    expect(assertSafeUrl('https://example.org/x.png').hostname).toBe('example.org')
    for (const bad of [
      'http://example.org/x.png',
      'file:///C:/secret.png',
      'https://localhost/x.png',
      'https://127.0.0.1/x.png',
      'https://192.168.1.4/x.png',
      'https://10.0.0.1/x.png',
      'https://172.20.0.1/x.png',
      'https://169.254.169.254/latest',
      'https://[::1]/x.png',
      'https://user:pw@example.org/x.png',
      'nonsense'
    ]) {
      expect(() => assertSafeUrl(bad), bad).toThrow()
    }
  })
})

describe('downloadImage', () => {
  it('downloads a JPEG, sends a User-Agent and decides the type from the bytes', async () => {
    const { fetchFn, calls } = fakeFetch(() => bytesResponse(JPEG, { 'content-type': 'text/html' }))
    const image = await downloadImage(URL1, { fetchFn, userAgent: 'Test/1 (x)' })
    expect(image).toMatchObject({ mime: 'image/jpeg', extension: 'jpg', finalUrl: URL1 })
    expect(Array.from(image.bytes)).toEqual(Array.from(JPEG))
    expect(calls[0].headers['user-agent']).toBe('Test/1 (x)')
    expect(calls[0].init.redirect).toBe('manual')
    // Openverse's thumbnail endpoint answers HTTP 406 to a bare "Accept: image/*" (seen live).
    expect(calls[0].headers.accept).toContain('*/*')
  })

  it('refuses a non-image even when the server calls it an image', async () => {
    const { fetchFn } = fakeFetch(() =>
      bytesResponse(new TextEncoder().encode('<html>login</html>'), {
        'content-type': 'image/jpeg'
      })
    )
    await expect(downloadImage(URL1, { fetchFn })).rejects.toMatchObject({ code: 'invalid-input' })
  })

  it('follows a few redirects, checking every hop', async () => {
    const { fetchFn, calls } = fakeFetch((_call, i) =>
      i === 0
        ? text('', 302, { location: '/b.png' })
        : i === 1
          ? text('', 301, { location: 'https://cdn.example.org/c.png' })
          : bytesResponse(PNG)
    )
    const image = await downloadImage(URL1, { fetchFn })
    expect(image.finalUrl).toBe('https://cdn.example.org/c.png')
    expect(calls.map((c) => c.url)).toEqual([
      URL1,
      'https://upload.example.org/b.png',
      'https://cdn.example.org/c.png'
    ])
  })

  it('stops at the redirect limit and refuses a redirect to a private or http address', async () => {
    const loop = fakeFetch(() => text('', 302, { location: '/again' }))
    await expect(
      downloadImage(URL1, { fetchFn: loop.fetchFn, maxRedirects: 2 })
    ).rejects.toMatchObject({ code: 'network' })
    expect(loop.calls).toHaveLength(3)
    for (const location of ['http://example.org/x.png', 'https://127.0.0.1/x.png']) {
      const evil = fakeFetch(() => text('', 302, { location }))
      await expect(downloadImage(URL1, { fetchFn: evil.fetchFn })).rejects.toMatchObject({
        code: 'invalid-input'
      })
      expect(evil.calls).toHaveLength(1)
    }
    const empty = fakeFetch(() => text('', 302))
    await expect(downloadImage(URL1, { fetchFn: empty.fetchFn })).rejects.toMatchObject({
      code: 'unknown'
    })
  })

  it('enforces the size limit by header and while streaming', async () => {
    const declared = fakeFetch(() =>
      bytesResponse(PNG, { 'content-length': String(11 * 1024 * 1024) })
    )
    await expect(downloadImage(URL1, { fetchFn: declared.fetchFn })).rejects.toMatchObject({
      code: 'too-large'
    })
    const big = new Uint8Array(2000)
    big.set(PNG)
    const streamed = fakeFetch(() => bytesResponse(big))
    await expect(
      downloadImage(URL1, { fetchFn: streamed.fetchFn, maxBytes: 1000 })
    ).rejects.toMatchObject({ code: 'too-large' })
    expect(
      (await downloadImage(URL1, { fetchFn: streamed.fetchFn, maxBytes: 2000 })).bytes.byteLength
    ).toBe(2000)
  })

  it('refuses SVG by default; when allowed it is checked and handed on as it came', async () => {
    const { fetchFn } = fakeFetch(() => bytesResponse(SVG))
    await expect(downloadImage(URL1, { fetchFn })).rejects.toMatchObject({ code: 'invalid-input' })
    const image = await downloadImage(URL1, { fetchFn, allowSvg: true })
    const svg = new TextDecoder().decode(image.bytes)
    expect(image).toMatchObject({ mime: 'image/svg+xml', extension: 'svg' })
    expect(svg).toBe(new TextDecoder().decode(SVG)) // untouched: only drawing uses a cleaned copy
    expect(svg).toContain('<circle')
    const broken = fakeFetch(() =>
      bytesResponse(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>'))
    )
    await expect(
      downloadImage(URL1, { fetchFn: broken.fetchFn, allowSvg: true })
    ).rejects.toMatchObject({ code: 'invalid-input' })
  })

  it('maps HTTP errors, network failures, abort and timeout', async () => {
    const code = async (response: () => Response): Promise<string | undefined> =>
      downloadImage(URL1, { fetchFn: fakeFetch(response).fetchFn }).then(
        () => undefined,
        (e: { code: string }) => e.code
      )
    expect(await code(() => text('', 404))).toBe('not-found')
    expect(await code(() => text('', 429))).toBe('rate-limited')
    expect(await code(() => text('', 500))).toBe('network')
    const down = fakeFetch(() => {
      throw new TypeError('fetch failed')
    })
    await expect(downloadImage(URL1, { fetchFn: down.fetchFn })).rejects.toMatchObject({
      code: 'network'
    })
    const controller = new AbortController()
    controller.abort()
    const ok = fakeFetch(() => bytesResponse(PNG))
    await expect(
      downloadImage(URL1, { fetchFn: ok.fetchFn, signal: controller.signal })
    ).rejects.toMatchObject({
      code: 'cancelled'
    })
    const hang = fakeFetch(
      (call) =>
        new Promise<Response>((_, reject) =>
          call.init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        )
    )
    await expect(
      downloadImage(URL1, { fetchFn: hang.fetchFn, timeoutMs: 20 })
    ).rejects.toMatchObject({
      code: 'network',
      message: expect.stringContaining('too long')
    })
  })
})
