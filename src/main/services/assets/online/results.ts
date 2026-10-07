/**
 * The search results the renderer can still point at (`OnlineResult.id`): kept in memory and in
 * `online/<resultId>.json` for 10 minutes (agents/ASSETS.md §2.7), so `online:add` and `placeAsset` can take
 * an id back after the page has re-rendered. Thumbnails are never stored here.
 */
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { newId } from '@shared/ids'
import type { OnlineKindFilter } from '@shared/contracts/assets'
import { atomicWriteJson, readJsonSafe } from '../../fsx'
import type { ImageSearchItem } from '../../imageProviders/types'

export const RESULT_TTL_MS = 10 * 60_000

export interface ResultRecord {
  id: string
  item: ImageSearchItem
  /** The A9 kind filter and the words the teacher searched with (for the kind and the tags). */
  filter: OnlineKindFilter
  query: string
  at: number
}

const isRecord = (raw: unknown): ResultRecord => {
  const r = raw as Partial<ResultRecord>
  if (
    !r ||
    typeof r.id !== 'string' ||
    typeof r.at !== 'number' ||
    typeof r.item?.fullUrl !== 'string'
  ) {
    throw new Error('not a result record')
  }
  return r as ResultRecord
}

export class ResultRegistry {
  private readonly records = new Map<string, ResultRecord>()

  constructor(
    private readonly dir: string,
    private readonly now: () => number = Date.now
  ) {}

  /** Remembers found items and returns their ids (same order). */
  async put(
    items: readonly ImageSearchItem[],
    context: Pick<ResultRecord, 'filter' | 'query'>
  ): Promise<string[]> {
    const at = this.now()
    const records = items.map((item) => ({ id: newId('ovr'), item, at, ...context }))
    for (const record of records) this.records.set(record.id, record)
    await Promise.all(
      records.map((r) => atomicWriteJson(join(this.dir, `${r.id}.json`), r).catch(() => undefined))
    )
    return records.map((r) => r.id)
  }

  /** The record, if it is still fresh; falls back to the disk copy after a restart. */
  async get(id: string): Promise<ResultRecord | undefined> {
    if (!/^ovr_[A-Za-z0-9]+$/.test(id)) return undefined
    const record =
      this.records.get(id) ?? (await readJsonSafe(join(this.dir, `${id}.json`), isRecord))
    if (!record) return undefined
    if (this.now() - record.at > RESULT_TTL_MS) {
      await this.forget(id)
      return undefined
    }
    this.records.set(id, record)
    return record
  }

  private async forget(id: string): Promise<void> {
    this.records.delete(id)
    await rm(join(this.dir, `${id}.json`), { force: true })
  }

  /** Removes expired records (memory and disk). Call at start-up and now and then. */
  async prune(): Promise<void> {
    const cutoff = this.now() - RESULT_TTL_MS
    for (const [id, record] of this.records) if (record.at < cutoff) this.records.delete(id)
    let names: string[] = []
    try {
      names = await readdir(this.dir)
    } catch {
      return
    }
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const file = join(this.dir, name)
      const record = await readJsonSafe(file, isRecord)
      if (!record || record.at < cutoff) await rm(file, { force: true })
    }
  }
}
