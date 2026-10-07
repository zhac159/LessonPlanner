import { appendFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { monthKey, UsageLog } from './usageLog'

const usage = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  cacheReadTokens: 0,
  cacheWriteTokens: 0
})

let dir: string
let file: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'usage-'))
  file = join(dir, 'usage.jsonl')
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('UsageLog', () => {
  it('appends entries with cost from the price table', async () => {
    const log = new UsageLog(file, () => new Date(2026, 9, 6, 12))
    await log.record({
      model: 'claude-opus-5-5',
      task: 'planLesson',
      usage: usage(1_000_000, 100_000)
    })
    const [entry] = await log.entries()
    expect(entry).toMatchObject({ model: 'claude-opus-5-5', task: 'planLesson' })
    expect(entry.costUsd).toBeCloseTo(4 + 2)
  })

  it('sums the current month by task and ignores other months', async () => {
    let now = new Date(2026, 8, 30, 10)
    const log = new UsageLog(file, () => now)
    await log.record({ model: 'claude-opus-5-5', task: 'writeSlide', usage: usage(1_000_000, 0) })
    now = new Date(2026, 9, 2, 10)
    await log.record({ model: 'claude-sonnet-5-5', task: 'writeSlide', usage: usage(1_000_000, 0) })
    await log.record({ model: 'claude-sonnet-5-5', task: 'chatTurn', usage: usage(0, 1_000_000) })
    const summary = await log.monthSummary()
    expect(summary.month).toBe('2026-10')
    expect(summary.calls).toBe(2)
    expect(summary.costUsd).toBeCloseTo(2 + 10)
    expect(summary.usage).toMatchObject({ inputTokens: 1_000_000, outputTokens: 1_000_000 })
    expect(summary.byTask.writeSlide.calls).toBe(1)
    expect(summary.byTask.writeSlide.costUsd).toBeCloseTo(2)
    expect((await log.monthSummary('2026-09')).costUsd).toBeCloseTo(4)
  })

  it('returns an empty summary when there is no file', async () => {
    const summary = await new UsageLog(join(dir, 'none.jsonl')).monthSummary('2026-10')
    expect(summary).toMatchObject({ calls: 0, costUsd: 0 })
  })

  it('skips corrupt and half-written lines', async () => {
    const log = new UsageLog(file)
    await log.record({ model: 'claude-opus-5-5', task: 'chatTurn', usage: usage(10, 10) })
    await appendFile(file, 'not json\n{"at":"x"}\n{"half":', 'utf8')
    expect(await log.entries()).toHaveLength(1)
  })

  it('never throws when the file cannot be written', async () => {
    await appendFile(file, '', 'utf8') // `usage.jsonl` is now a file, so a path below it is impossible
    const log = new UsageLog(join(file, 'nested', 'x.jsonl'))
    await expect(
      log.record({ model: 'claude-opus-5-5', task: 'chatTurn', usage: usage(1, 1) })
    ).resolves.toBeUndefined()
  })

  it('formats month keys with a zero-padded month', () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe('2026-01')
  })
})
