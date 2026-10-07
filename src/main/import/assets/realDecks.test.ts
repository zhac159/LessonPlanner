/**
 * Runs the extractor on the teacher's two real PDF decks in `example/` (skipped when the folder is absent).
 * Set WRITE_EXAMPLE_ASSETS=1 to also write what it finds to `.artifacts/example-assets/` for looking at.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cropSymbolCards, extractAssets, groupFindings, type ExtractedImage } from '.'

const dir = resolve('example')
const decks = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.pdf')) : []

describe.skipIf(decks.length < 2)('real decks (example/*.pdf)', () => {
  it('finds the school logo once on 18 pages and her content pictures', async () => {
    const all: ExtractedImage[] = []
    for (const name of decks) {
      const result = await extractAssets({
        name,
        bytes: new Uint8Array(readFileSync(join(dir, name)))
      })
      expect(result.scanned).toBe(false)
      all.push(...result.images)
    }
    const findings = groupFindings(all)
    const logo = findings.assets.find((a) => a.kind === 'logo')
    expect(logo?.foundOn).toBe(18)
    expect(logo?.image.mime).toBe('image/jpeg')
    expect(findings.assets.filter((a) => a.kind === 'logo')).toHaveLength(1)
    // the two lesson-plan screenshots on page 1 are page-like and ignored
    expect(findings.ignored.fullPage).toBe(2)
    expect(findings.found).toBeGreaterThanOrEqual(14)
    expect(findings.keeping).toBeGreaterThanOrEqual(13)
    expect(findings.assets.filter((a) => a.kind === 'photo').length).toBeGreaterThanOrEqual(7)
    expect(findings.assets.filter((a) => a.kind === 'symbol-card').length).toBeGreaterThanOrEqual(5)

    if (process.env.WRITE_EXAMPLE_ASSETS) {
      const out = resolve('.artifacts/example-assets')
      mkdirSync(join(out, 'cards'), { recursive: true })
      for (const asset of findings.assets) {
        const ext = asset.image.mime === 'image/jpeg' ? 'jpg' : 'png'
        writeFileSync(join(out, `${asset.suggestedName}.${ext}`), asset.image.bytes)
        if (asset.kind === 'symbol-card') {
          const split = await cropSymbolCards(asset.image)
          split.cards.forEach((c, i) =>
            writeFileSync(join(out, 'cards', `${asset.suggestedName}_${i + 1}.png`), c.bytes)
          )
        }
      }
    }
  })

  it('splits her symbol-card strips and grids into single cards', async () => {
    const name = decks.find((d) => d.startsWith('L3')) as string
    const result = await extractAssets({
      name,
      bytes: new Uint8Array(readFileSync(join(dir, name)))
    })
    const sheets = result.images.filter((i) => i.kindHint === 'symbol-card')
    const counts = new Set<number>()
    for (const sheet of sheets) {
      const split = await cropSymbolCards(sheet)
      if (split.cards.length) counts.add(split.cards.length)
    }
    // strips of 3 ("things people places"), grids of 6 ("wolf uncle knife ...") and 4 ("Add -s ...")
    expect(counts.has(3)).toBe(true)
    expect(counts.has(6)).toBe(true)
    expect(counts.has(4)).toBe(true)
  })
})
