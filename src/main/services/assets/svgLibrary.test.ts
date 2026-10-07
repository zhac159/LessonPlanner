import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { decodePng } from '../../import/assets/png'
import { AssetStore } from './store'
import { cleanTemp, newAssetInput, tempDir } from './testing'
import { createPureImageTools, renderableSvg } from './thumbs'

afterEach(cleanTemp)

const tools = createPureImageTools()
const open = async () => {
  const store = new AssetStore({ dir: await tempDir(), tools })
  await store.load()
  return store
}

// Colours the way Illustrator and Inkscape write them: class rules, style attributes, a gradient.
const DRAWN = `<?xml version="1.0"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" width="40px" height="20px">
<style>.red{fill:#ff0000}</style>
<defs><linearGradient id="g"><stop offset="0" style="stop-color:#0000ff"/><stop offset="1" style="stop-color:#0000ff"/></linearGradient></defs>
<rect class="red" width="20" height="20"/><rect x="20" style="fill:url(#g)" width="20" height="20"/>
</svg>`

const pixel = (png: Uint8Array, x: number, y: number): number[] => {
  const raster = decodePng(png)
  const at = (y * raster.width + x) * 4
  return [...raster.data.subarray(at, at + 3)]
}

describe('library SVG: original kept, sanitised only for drawing', () => {
  it('draws class, style attribute and gradient colours instead of losing them', async () => {
    const drawn = await tools.scale(new TextEncoder().encode(DRAWN), '.svg', 40)
    expect(drawn).toMatchObject({ width: 40, height: 20 })
    expect(pixel(drawn!.png, 5, 10)).toEqual([255, 0, 0])
    expect(pixel(drawn!.png, 35, 10)).toEqual([0, 0, 255])
  })

  it('stores a drawing program file untouched and has nothing to warn about', async () => {
    const store = await open()
    const bytes = new TextEncoder().encode(DRAWN)
    const asset = await store.create(newAssetInput('drawn', { bytes, ext: '.svg' }))
    expect(Buffer.from((await readFile(store.filePath(asset)))!).toString()).toBe(DRAWN)
    expect(asset.file.dropped).toBeUndefined()
    expect(asset.file.width).toBeGreaterThan(0)
    expect(asset.file.phash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('replace file keeps the new original too, and drawing never sees hostile parts', async () => {
    const store = await open()
    const first = await store.create(
      newAssetInput('drawn', { bytes: new TextEncoder().encode(DRAWN), ext: '.svg' })
    )
    const hostile = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="x()"><image href="file:///C:/secret.png" width="10" height="10"/><circle cx="5" cy="5" r="4"/></svg>'
    )
    const next = await store.replaceFile(first.id, hostile, '.svg')
    expect(await store.readOriginal(next)).toEqual(hostile)
    expect(next.file.dropped).toEqual(expect.arrayContaining(['<image>']))
    expect(renderableSvg(hostile)).not.toMatch(/image|secret|onload/)
  })
})
