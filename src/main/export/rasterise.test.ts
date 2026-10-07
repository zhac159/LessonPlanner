import { describe, expect, it } from 'vitest'
import { sniffImage } from './imageInfo'
import { rasteriseSvg } from './rasterise'

const svg = (w: number, h: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#0e7c7b"/></svg>`

describe('rasteriseSvg', () => {
  it('renders a PNG of the requested width, keeping the aspect ratio', async () => {
    const png = await rasteriseSvg(svg(100, 50), 800)
    expect(sniffImage(png)).toMatchObject({ mime: 'image/png', width: 800, height: 400 })
  })

  it('caps very large requests', async () => {
    const png = await rasteriseSvg(svg(10, 10), 100000)
    expect((sniffImage(png) as { width: number }).width).toBe(4096)
  })

  it('rounds up tiny requests to at least one pixel', async () => {
    const png = await rasteriseSvg(svg(10, 10), 0)
    expect((sniffImage(png) as { width: number }).width).toBe(1)
  })

  it('throws on malformed SVG so callers can fall back', async () => {
    await expect(rasteriseSvg('<svg><oops', 100)).rejects.toThrow()
  })

  it('does not fetch external resources', async () => {
    const hostile = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><image xlink:href="http://127.0.0.1:1/x.png" width="10" height="10"/></svg>`
    const png = await rasteriseSvg(hostile, 20)
    expect(sniffImage(png)?.kind).toBe('raster')
  })
})
