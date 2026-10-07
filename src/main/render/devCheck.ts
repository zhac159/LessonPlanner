/**
 * Development only: the entry `scripts/render-check.mjs` bundles and runs with Electron to exercise the
 * real SlideRenderer (hidden window, preload, render page) on the photosynthesis fixture. It is not part of
 * the app: nothing imports it. It writes PNGs and a result.json into $RENDER_CHECK_OUT and quits.
 */
import { app } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { simplifyPath } from '@shared/annotate/simplify'
import { polygonBoundingBox } from '@shared/annotate/geometry'
import { targetElementIds } from '@shared/annotate/overlap'
import type { Point } from '@shared/annotate/types'
import deckJson from '../../../design/fixtures/deck.photosynthesis.json'
import styleJson from '../../../design/fixtures/style-profile.science-ks3.json'
import type { Deck, ImageElement, Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { renderExamples } from './devCheckExample'
import { createSlideRenderer } from './index'

const deck = deckJson as unknown as Deck
const style = styleJson as unknown as StyleProfile

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Uint8Array): string => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return `${view.getUint32(16)}x${view.getUint32(20)}`
}

/** A wobbly hand-drawn circle around the photo on slide 3, as the pointer would record it. */
function handDrawnLoop(): Point[] {
  const points: Point[] = []
  for (let i = 0; i <= 90; i += 1) {
    const angle = (i / 90) * Math.PI * 2 + 0.4
    const wobble = 1 + Math.sin(i * 1.7) * 0.01
    points.push([1467 + Math.cos(angle) * 440 * wobble, 550 + Math.sin(angle) * 330 * wobble])
  }
  return points
}

const leafSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#cfe8c4"/><path d="M60 240C60 100 200 40 340 60C330 200 200 260 60 240Z" fill="#3a8f4b"/><path d="M60 240L300 90" stroke="#1d5a2b" stroke-width="6" fill="none"/></svg>`

async function run(outDir: string, buildDir: string): Promise<Record<string, unknown>> {
  const renderer = createSlideRenderer({
    rendererDir: join(buildDir, 'renderer'),
    preloadPath: join(buildDir, 'preload', 'render.js')
  })
  const files: Array<{ name: string; size: string; bytes: number; ms: number }> = []
  const save = async (name: string, make: () => Promise<Uint8Array>): Promise<void> => {
    const started = Date.now()
    const png = await make()
    await writeFile(join(outDir, name), png)
    files.push({ name, size: pngSize(png), bytes: png.byteLength, ms: Date.now() - started })
  }
  try {
    for (const slide of deck.slides) {
      await save(`${slide.id}-plain.png`, () => renderer.renderSlidePng({ slide, style }))
    }
    const slide3 = deck.slides[2]
    const path = simplifyPath(handDrawnLoop())
    const bbox = polygonBoundingBox(path)
    const regions = [{ n: 1, path, bbox }]
    await save('s3-region.png', () =>
      renderer.renderSlidePng({
        slide: slide3,
        style,
        regions,
        // A Draw-tool underline beneath the heading.
        strokes: [
          [
            [125, 345],
            [600, 352],
            [900, 340]
          ]
        ]
      })
    )
    await save('s3-crop.png', () => renderer.renderCropPng({ slide: slide3, style, bbox }))
    await save('s3-thumb.png', () => renderer.renderThumbnail({ slide: slide3, style }))
    await save('s3-nostyle.png', () => renderer.renderSlidePng({ slide: slide3, style: null }))

    const withAsset: Slide = {
      ...slide3,
      elements: slide3.elements.map((element) =>
        element.id === 's3-photo' ? ({ ...element, assetId: 'leaf.svg' } as ImageElement) : element
      )
    }
    await save('s3-asset.png', () =>
      renderer.renderSlidePng({
        slide: withAsset,
        style,
        assets: { 'leaf.svg': new TextEncoder().encode(leafSvg) }
      })
    )
    const examples = process.env['RENDER_CHECK_EXAMPLE']
    if (examples) await renderExamples(renderer, save, examples)
    return { ok: true, targets: targetElementIds(slide3, { path }), bbox, files }
  } finally {
    renderer.dispose()
  }
}

void app.whenReady().then(async () => {
  const outDir = process.env['RENDER_CHECK_OUT'] ?? ''
  const buildDir = process.env['RENDER_CHECK_BUILD'] ?? ''
  await mkdir(outDir, { recursive: true })
  let result: Record<string, unknown>
  try {
    result = await run(outDir, buildDir)
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error)
    }
  }
  await writeFile(join(outDir, 'result.json'), JSON.stringify(result, null, 2))
  app.quit()
})
