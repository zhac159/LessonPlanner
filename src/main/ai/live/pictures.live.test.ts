/**
 * LIVE checks for the picture calls (WP5): describeAssets, describeStyleOfAssets, drawSvg on the teacher's REAL
 * extracted pictures (example/*.pdf). Run: npm run test:live -- pictures
 * Budget for this file: $1 (checked against the usage of this process only). Thumbnails and results are written
 * to .artifacts/live/pictures/ so they can be looked at.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { beforeAll, describe, expect, it } from 'vitest'
import type { AiService, DescribeImageInput, DescribedAsset } from '@shared/ai/types'
import { checkAssetName } from '@shared/assets'
import {
  decodeImage,
  encodePng,
  extractAssets,
  groupFindings,
  type ExtractedImage,
  type FoundAsset
} from '../../import/assets'
import { createLiveService, hasKey, saveArtifact, SKIP_MESSAGE, unwrap, usageSeen } from './harness'

const BUDGET_USD = 1
const OUT = resolve('.artifacts/live/pictures')
const decksDir = resolve('example')
const decks = existsSync(decksDir) ? readdirSync(decksDir).filter((f) => f.endsWith('.pdf')) : []

const spent = (): number => usageSeen.reduce((sum, u) => sum + u.usd, 0)
const guard = (): void => {
  if (spent() > BUDGET_USD) throw new Error(`budget of $${BUDGET_USD} used up`)
}

/** Box-filter downscale to at most `max` px on the long side, as PNG. */
async function thumbnail(image: ExtractedImage, max: number): Promise<Uint8Array> {
  const raster = await decodeImage(image.bytes, image.mime)
  if (!raster) throw new Error(`cannot decode ${image.id}`)
  const scale = Math.min(1, max / Math.max(raster.width, raster.height))
  const w = Math.max(1, Math.round(raster.width * scale))
  const h = Math.max(1, Math.round(raster.height * scale))
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor((x * raster.width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * raster.width) / w))
      const y0 = Math.floor((y * raster.height) / h)
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * raster.height) / h))
      const sum = [0, 0, 0, 0]
      let n = 0
      for (let yy = y0; yy < y1; yy += 1)
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * raster.width + xx) * 4
          for (let c = 0; c < 4; c += 1) sum[c]! += raster.data[i + c]!
          n += 1
        }
      for (let c = 0; c < 4; c += 1) out[(y * w + x) * 4 + c] = Math.round(sum[c]! / n)
    }
  }
  return encodePng(out, w, h, 'rgba')
}

describe.skipIf(!hasKey() || decks.length === 0)(
  'live: describing the teacher’s real pictures',
  () => {
    if (!hasKey()) console.log(SKIP_MESSAGE)
    let ai: AiService
    let chosen: FoundAsset[] = []
    let found: FoundAsset[] = []
    let inputs: DescribeImageInput[] = []
    let described: DescribedAsset[] = []
    const thumbs512: Uint8Array[] = []

    beforeAll(async () => {
      ai = createLiveService()
      mkdirSync(OUT, { recursive: true })
      const all: ExtractedImage[] = []
      for (const name of decks) {
        const result = await extractAssets({
          name,
          bytes: new Uint8Array(readFileSync(join(decksDir, name)))
        })
        all.push(...result.images)
      }
      found = groupFindings(all).assets.filter((a) => !a.image.maybePupils && !a.needsReview)
      const first = (kind: string, skip = 0) => found.filter((a) => a.kind === kind)[skip]
      chosen = [
        first('logo'),
        first('symbol-card'),
        first('symbol-card', 1),
        first('photo'),
        first('photo', 1),
        first('icon')
      ].filter((a): a is FoundAsset => Boolean(a))
      for (const [i, asset] of chosen.entries()) {
        const png = await thumbnail(asset.image, 512)
        thumbs512.push(png)
        writeFileSync(join(OUT, `thumb_${i + 1}_${asset.kind}.png`), png)
        inputs.push({
          index: i + 1,
          png,
          hint: asset.kind,
          nearbyText: asset.nearbyText,
          fileNames: asset.foundIn.map((f) => f.fileName),
          sha256: asset.image.hash
        })
      }
    })

    it('describeAssets: the real grammar accepts the schema and the names and descriptions are sensible', async () => {
      guard()
      expect(chosen.length).toBeGreaterThanOrEqual(4)
      const result = unwrap(
        await ai.describeAssets({ images: inputs, taken: ['school_crest'] }),
        'describeAssets'
      )
      described = result.described
      saveArtifact('pictures-described.json', {
        sent: inputs.map((i) => ({
          index: i.index,
          hint: i.hint,
          nearbyText: i.nearbyText,
          bytes: i.png.length
        })),
        described
      })
      for (const d of described) {
        const row = inputs.find((i) => i.index === d.index)!
        console.log(
          `[live] #${d.index} (hint ${row.hint}, near "${row.nearbyText.slice(0, 50)}") -> ${d.kind} | ${d.title} | ${d.name} | ${d.description} | ${d.tags.join(',')} | pupils=${d.maybePupils} blurry=${d.blurry} older=${d.olderVersionOf}`
        )
      }
      expect(described).toHaveLength(inputs.length)
      expect(new Set(described.map((d) => d.name)).size).toBe(described.length)
      for (const d of described) {
        expect(checkAssetName(d.name, []).ok).toBe(true)
        expect(d.description.length).toBeGreaterThan(10)
        expect(d.title.split(' ').length).toBeLessThanOrEqual(6)
      }
    })

    it('describeAssets again: the same pictures cost nothing (cache by sha256)', async () => {
      guard()
      const before = usageSeen.length
      const again = unwrap(
        await ai.describeAssets({ images: inputs, taken: [] }),
        'describeAssets (cached)'
      )
      expect(usageSeen.length).toBe(before)
      expect(again.described.map((d) => d.title)).toEqual(described.map((d) => d.title))
    })

    it('describeAssets: a whole deck of candidates goes out in requests of at most 12', async () => {
      guard()
      const wanted = Math.min(found.length, 20)
      const batch = await Promise.all(
        found.slice(0, wanted).map(async (asset, i) => ({
          index: 100 + i,
          png: await thumbnail(asset.image, 512),
          hint: asset.kind,
          nearbyText: asset.nearbyText,
          fileNames: asset.foundIn.map((f) => f.fileName),
          sha256: asset.image.hash + 'x'
        }))
      )
      const before = usageSeen.length
      const out = unwrap(
        await ai.describeAssets({ images: batch, taken: described.map((d) => d.name) }),
        'describeAssets (all)'
      )
      saveArtifact('pictures-described-all.json', out.described)
      console.log(
        `[live] all: ${batch.length} pictures, ${usageSeen.length - before} requests, ${out.described.length} described`
      )
      expect(usageSeen.length - before).toBe(Math.ceil(batch.length / 12))
      expect(out.described).toHaveLength(batch.length)
      expect(new Set(out.described.map((d) => d.name)).size).toBe(batch.length)
    })

    let styleDescription = ''
    it('describeStyleOfAssets: a short look description from three drawn pictures', async () => {
      guard()
      const drawn = chosen.filter((a) => a.kind !== 'photo').slice(0, 3)
      expect(drawn.length).toBeGreaterThanOrEqual(2)
      const images = await Promise.all(drawn.map((a) => thumbnail(a.image, 384)))
      const out = unwrap(
        await ai.describeStyleOfAssets({
          images,
          kinds: drawn.map((a) =>
            a.kind === 'logo' ? 'logo' : a.kind === 'icon' ? 'icon' : 'symbol-card'
          )
        }),
        'describeStyleOfAssets'
      )
      styleDescription = out.description
      console.log(`[live] style (${out.description.split(' ').length} words): ${out.description}`)
      saveArtifact('pictures-style.json', out)
      expect(out.description.split(' ').length).toBeLessThanOrEqual(90)
    })

    it('drawSvg: Claude draws two icons that survive the sanitiser', async () => {
      guard()
      const out = unwrap(
        await ai.drawSvg({
          prompt: 'a laboratory beaker with a little liquid in it',
          styleDescription,
          kind: 'icon',
          versions: 2
        }),
        'drawSvg'
      )
      out.svgs.forEach((svg, i) => {
        writeFileSync(join(OUT, `draw_${i + 1}.svg`), svg)
        writeFileSync(
          join(OUT, `draw_${i + 1}.png`),
          new Resvg(svg, { fitTo: { mode: 'width', value: 400 }, background: '#ffffff' })
            .render()
            .asPng()
        )
        console.log(
          `[live] svg ${i + 1}: ${svg.length} bytes, ${(svg.match(/<(path|rect|circle|ellipse|polygon|line|polyline)\b/g) ?? []).length} shapes`
        )
      })
      expect(out.svgs.length).toBeGreaterThanOrEqual(1)
      for (const svg of out.svgs) expect(svg).toMatch(/^<svg xmlns=/)
      console.log(`[live] pictures spend this run: $${spent().toFixed(4)}`)
      expect(spent()).toBeLessThanOrEqual(BUDGET_USD)
    })
  }
)
