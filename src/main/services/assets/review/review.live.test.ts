/**
 * LIVE check of the whole "add from a PDF" path (WP2): the teacher's REAL example decks (example/*.pdf) go through
 * the review queue with the real Claude, into a temp data folder; the batch is accepted and the saved names,
 * descriptions and thumbnails are written to .artifacts/live/review/ so they can be looked at.
 * Run: npm run test:live -- review    Budget for this file: $0.40 (usage of this process only).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanTemp, tempDir, testService } from '../testing'
import {
  createLiveService,
  hasKey,
  redact,
  SKIP_MESSAGE,
  usageSeen
} from '../../../ai/live/harness'
import { createFileDescribeCache } from './describeCache'
import { ReviewService } from './service'

const BUDGET_USD = 0.4
const OUT = resolve('.artifacts/live/review')
const decksDir = resolve('example')
const decks = existsSync(decksDir)
  ? readdirSync(decksDir)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => join(decksDir, f))
  : []
const live = hasKey() && decks.length > 0

const spent = (): number => usageSeen.reduce((sum, u) => sum + u.usd, 0)

describe.skipIf(!live)('add from the example PDFs, for real', () => {
  beforeAll(() => {
    if (!live) console.log(SKIP_MESSAGE)
    mkdirSync(OUT, { recursive: true })
  })
  afterAll(cleanTemp)

  it('reads, groups, names and keeps the pictures of both decks', async () => {
    const root = await tempDir()
    const dir = join(root, 'assets')
    const assets = testService(dir)
    await assets.init()
    const review = new ReviewService({
      dir,
      assets,
      ai: createLiveService(),
      tools: assets.tools,
      cache: createFileDescribeCache(dir),
      emit: () => undefined,
      log: { warn: (message) => console.log(`[review] ${redact(message)}`) }
    })

    const started = await review.addPaths(decks)
    expect(started).toMatchObject({ ok: true, accepted: decks.length })
    await review.idle()
    expect(spent()).toBeLessThan(BUDGET_USD)

    const view = review.view()
    const rows = view.candidates.map((c) => ({
      name: c.name,
      title: c.title,
      kind: c.kind,
      keep: c.keep,
      leftOut: c.leftOut,
      decks: c.decks,
      description: c.description,
      tags: c.tags,
      size: `${c.width}x${c.height}`
    }))
    console.log(
      `[review] found ${view.found}, keeping ${view.keeping}, files: ${view.batches[0]?.files
        .map((f) => `${f.name} ${f.state} ${f.found}`)
        .join(' | ')}, spent $${spent().toFixed(3)}`
    )
    writeFileSync(join(OUT, 'candidates.json'), redact(JSON.stringify(rows, null, 2)))

    const saved = await review.accept()
    expect(saved.ok).toBe(true)
    const added = saved.ok && 'added' in saved ? saved.added : []
    expect(added.length).toBe(view.keeping)
    expect(review.view().batches).toEqual([])

    // a contact sheet of what was saved, to look at
    const library = await assets.list({ limit: 200 })
    const cell = 170
    const cols = 6
    const items = library.items
    const body = items
      .map((item, i) => {
        const x = (i % cols) * cell
        const y = Math.floor(i / cols) * (cell + 24)
        const image = item.thumbDataUrl
          ? `<image href="${item.thumbDataUrl}" x="${x + 5}" y="${y + 5}" width="${cell - 10}" height="${cell - 10}" preserveAspectRatio="xMidYMid meet"/>`
          : ''
        return `<rect x="${x + 2}" y="${y + 2}" width="${cell - 4}" height="${cell - 4}" fill="#eeeaf8"/>${image}<text x="${x + 5}" y="${y + cell + 12}" font-size="11" font-family="Arial" fill="#111">${item.name} (${item.kind})</text>`
      })
      .join('')
    const height = Math.ceil(items.length / cols) * (cell + 24)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${height}"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: cols * cell } }).render().asPng()
    writeFileSync(join(OUT, 'saved.png'), png)
    writeFileSync(
      join(OUT, 'library.json'),
      redact(
        JSON.stringify(
          items.map((i) => ({ name: i.name, kind: i.kind, tags: i.tags })),
          null,
          2
        )
      )
    )
    expect(spent()).toBeLessThan(BUDGET_USD)
  })
})
