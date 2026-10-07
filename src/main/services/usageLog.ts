/**
 * Append-only record of every Claude response's token usage (design/ai-pipeline.md §10): `usage.jsonl`, one JSON
 * object per line. Settings › AI shows "This month: about $X" from `monthSummary`. Prices live in
 * `src/shared/ai/prices.ts`. Recording never throws: a full disk must not break a lesson.
 */
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { EMPTY_USAGE, addUsage, costOf } from '@shared/ai/prices'
import type { AiTask, Usage } from '@shared/ai/types'
import { appendJsonl } from './fsx'

export interface UsageEntry {
  /** ISO timestamp. */
  at: string
  model: string
  task: AiTask
  usage: Usage
  /** Dollar cost at the time of the call (prices.ts). */
  costUsd: number
}

export interface MonthSummary {
  /** `YYYY-MM` in local time. */
  month: string
  calls: number
  costUsd: number
  usage: Usage
  byTask: Record<string, { calls: number; costUsd: number }>
}

const entrySchema = z.object({
  at: z.string(),
  model: z.string(),
  task: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheReadTokens: z.number(),
    cacheWriteTokens: z.number()
  }),
  costUsd: z.number()
})

/** The sink the AI layer writes to; implemented by `UsageLog` and by test spies. */
export interface UsageSink {
  record(entry: { model: string; task: AiTask; usage: Usage }): void | Promise<void>
}

export const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export class UsageLog implements UsageSink {
  constructor(
    private readonly file: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Appends one entry (cost computed here). Swallows write errors. */
  async record(entry: { model: string; task: AiTask; usage: Usage }): Promise<void> {
    const line: UsageEntry = {
      at: this.now().toISOString(),
      model: entry.model,
      task: entry.task,
      usage: entry.usage,
      costUsd: costOf(entry.model, entry.usage)
    }
    try {
      await appendJsonl(this.file, line)
    } catch {
      /* usage is best-effort */
    }
  }

  /** Every readable entry, oldest first. Bad lines (half-written, hand-edited) are skipped. */
  async entries(): Promise<UsageEntry[]> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch {
      return []
    }
    const entries: UsageEntry[] = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const parsed = entrySchema.safeParse(JSON.parse(line))
        if (parsed.success) entries.push(parsed.data as UsageEntry)
      } catch {
        /* skip */
      }
    }
    return entries
  }

  /** Totals for one month (default: the current month). */
  async monthSummary(month: string = monthKey(this.now())): Promise<MonthSummary> {
    const summary: MonthSummary = {
      month,
      calls: 0,
      costUsd: 0,
      usage: { ...EMPTY_USAGE },
      byTask: {}
    }
    for (const entry of await this.entries()) {
      if (monthKey(new Date(entry.at)) !== month) continue
      summary.calls += 1
      summary.costUsd += entry.costUsd
      summary.usage = addUsage(summary.usage, entry.usage)
      const task = (summary.byTask[entry.task] ??= { calls: 0, costUsd: 0 })
      task.calls += 1
      task.costUsd += entry.costUsd
    }
    return summary
  }
}
