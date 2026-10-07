/**
 * The lesson list: `index.json` is a cache of what Home shows, rebuilt from the lesson folders when it is
 * missing, damaged or out of step with them. A lesson whose files cannot be read still gets an entry (marked
 * `damaged`), so Home can show a recoverable card instead of hiding it or crashing (deck-model.md §7).
 */
import { z } from 'zod'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { Deck } from '@shared/deck/types'
import { atomicWriteJson, readJsonSafe } from '../fsx'
import type { LessonPaths } from './paths'
import type { LessonStore } from './store'

/** Home's card without the parts that change independently of the deck (thumbnail, running state). */
export interface IndexEntry {
  id: string
  title: string
  yearGroup: string | null
  yearShort: string | null
  slideCount: number
  updatedAt: string
  styleId: string | null
  /** True when the lesson's files could not be read. */
  damaged?: boolean
}

/** A list row: the contract's `LessonSummary` plus `damaged` for lessons that cannot be opened. */
export type LessonListItem = LessonSummary & { damaged?: boolean }

const entrySchema = z.object({
  id: z.string(),
  title: z.string(),
  yearGroup: z.string().nullable(),
  yearShort: z.string().nullable(),
  slideCount: z.number(),
  updatedAt: z.string(),
  styleId: z.string().nullable(),
  damaged: z.boolean().optional()
})
const indexSchema = z.object({ v: z.literal(1), lessons: z.array(entrySchema) })

const YEAR = /^(?:y|yr|year)\s*(\d{1,2})$/i

/** "Y8" and "year 8" both become "Year 8"; anything else is kept as typed, its first word being the short tag. */
export function yearLabels(yearGroup: string | undefined): {
  yearGroup: string | null
  yearShort: string | null
} {
  const text = yearGroup?.trim()
  if (!text) return { yearGroup: null, yearShort: null }
  const year = YEAR.exec(text)
  if (year) return { yearGroup: `Year ${year[1]}`, yearShort: `Year ${year[1]}` }
  return { yearGroup: text, yearShort: text.split(/\s+/)[0] }
}

/** The index entry for the lesson in folder `id`. */
export function entryOf(id: string, deck: Deck): IndexEntry {
  return {
    id,
    title: deck.title,
    ...yearLabels(deck.meta.yearGroup),
    slideCount: deck.slides.length,
    updatedAt: deck.updatedAt,
    styleId: deck.styleId
  }
}

const dataUrl = (png: Uint8Array): string =>
  `data:image/png;base64,${Buffer.from(png).toString('base64')}`

/** Turns an entry into the list row. */
export function toListItem(
  entry: IndexEntry,
  thumb: Uint8Array | undefined,
  generating: boolean
): LessonListItem {
  const { damaged, ...rest } = entry
  return {
    ...rest,
    thumbDataUrl: thumb ? dataUrl(thumb) : null,
    status: generating ? 'generating' : 'ready',
    ...(damaged ? { damaged: true } : {})
  }
}

export class SummaryIndex {
  private entries: Map<string, IndexEntry> | undefined

  constructor(
    private readonly paths: LessonPaths,
    private readonly store: LessonStore,
    private readonly now: () => Date
  ) {}

  /** The entries, newest first. Rebuilds the cache when it does not match the folders. */
  async list(): Promise<IndexEntry[]> {
    const entries = await this.load()
    return [...entries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<IndexEntry | undefined> {
    return (await this.load()).get(id)
  }

  /** Writes (or replaces) one entry. */
  async upsert(entry: IndexEntry): Promise<void> {
    const entries = await this.load()
    entries.set(entry.id, entry)
    await this.save()
  }

  async remove(id: string): Promise<void> {
    const entries = await this.load()
    if (entries.delete(id)) await this.save()
  }

  private async load(): Promise<Map<string, IndexEntry>> {
    const ids = await this.store.listIds()
    if (this.entries && sameIds(this.entries, ids)) return this.entries
    const stored = await readJsonSafe(this.paths.index, (raw) => indexSchema.parse(raw))
    const map = new Map((stored?.lessons ?? []).map((e) => [e.id, e]))
    if (stored && sameIds(map, ids)) {
      this.entries = map
      return map
    }
    return this.rebuild(ids, map)
  }

  /** Reads every lesson folder; `previous` supplies the last known title of lessons that cannot be read. */
  private async rebuild(
    ids: string[],
    previous: Map<string, IndexEntry>
  ): Promise<Map<string, IndexEntry>> {
    const map = new Map<string, IndexEntry>()
    for (const id of ids) {
      const read = await this.store.readDeck(id)
      map.set(id, read.ok ? entryOf(id, read.deck) : damagedEntry(id, previous.get(id), this.now()))
    }
    this.entries = map
    await this.save()
    return map
  }

  private save(): Promise<void> {
    return atomicWriteJson(this.paths.index, { v: 1, lessons: [...(this.entries?.values() ?? [])] })
  }
}

const sameIds = (entries: Map<string, IndexEntry>, ids: readonly string[]): boolean =>
  entries.size === ids.length && ids.every((id) => entries.has(id))

function damagedEntry(id: string, previous: IndexEntry | undefined, now: Date): IndexEntry {
  return {
    id,
    title: previous?.title ?? 'Lesson that can’t be opened',
    yearGroup: previous?.yearGroup ?? null,
    yearShort: previous?.yearShort ?? null,
    slideCount: previous?.slideCount ?? 0,
    updatedAt: previous?.updatedAt ?? now.toISOString(),
    styleId: previous?.styleId ?? null,
    damaged: true
  }
}
