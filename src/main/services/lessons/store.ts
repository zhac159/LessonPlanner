/**
 * Disk access for ONE lesson folder: the deck, its sidecar, the change journal, the generation record and
 * the thumbnail. Pure file work, no rules: LessonEditor and LessonsService decide what to write and when.
 * Every write is atomic (temp file + rename); reading never throws on damaged files.
 */
import { appendFile, cp, readFile, readdir, rm } from 'node:fs/promises'
import { relative, sep } from 'node:path'
import { z } from 'zod'
import type { StickyNote } from '@shared/contracts/deck-builder'
import { parseDeck } from '@shared/deck/schema'
import type { Deck } from '@shared/deck/types'
import { writeFileAtomic } from '../../export/save'
import { atomicWriteJson, ensureDir, readJsonSafe } from '../fsx'
import { isSafeId, type LessonPaths } from './paths'
import type { GenerationRecord } from './types'

const stickyNoteSchema = z.object({
  id: z.string(),
  slideId: z.string(),
  x: z.number(),
  y: z.number(),
  text: z.string()
})

const sidecarSchema = z.object({
  v: z.literal(1),
  titleSource: z.enum(['auto', 'user']),
  stickyNotes: z.array(stickyNoteSchema)
})

/** `lesson.json`: what is not part of the Deck itself. */
export interface Sidecar {
  titleSource: 'auto' | 'user'
  stickyNotes: StickyNote[]
}

export const DEFAULT_SIDECAR: Sidecar = { titleSource: 'auto', stickyNotes: [] }

export type DeckRead =
  { ok: true; deck: Deck } | { ok: false; reason: 'missing' | 'corrupt'; detail: string }

export class LessonStore {
  constructor(private readonly paths: LessonPaths) {}

  /** Ids of the lesson folders on disk (folders with unsafe names are ignored). */
  async listIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.paths.lessons, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory() && isSafeId(e.name)).map((e) => e.name)
    } catch {
      return []
    }
  }

  async exists(id: string): Promise<boolean> {
    return (await this.listIds()).includes(id)
  }

  async readDeck(id: string): Promise<DeckRead> {
    let text: string
    try {
      text = await readFile(this.paths.deck(id), 'utf8')
    } catch {
      return { ok: false, reason: 'missing', detail: 'deck.json is missing' }
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'corrupt', detail: 'deck.json is not valid JSON' }
    }
    const parsed = parseDeck(json)
    return parsed.ok
      ? { ok: true, deck: parsed.value }
      : { ok: false, reason: 'corrupt', detail: parsed.errors[0] ?? parsed.message }
  }

  writeDeck(id: string, deck: Deck): Promise<void> {
    return atomicWriteJson(this.paths.deck(id), deck)
  }

  async readSidecar(id: string): Promise<Sidecar> {
    const sidecar = await readJsonSafe(this.paths.state(id), (raw) => sidecarSchema.parse(raw))
    return sidecar
      ? { titleSource: sidecar.titleSource, stickyNotes: sidecar.stickyNotes }
      : { ...DEFAULT_SIDECAR, stickyNotes: [] }
  }

  writeSidecar(id: string, sidecar: Sidecar): Promise<void> {
    return atomicWriteJson(this.paths.state(id), { v: 1, ...sidecar })
  }

  /** The journal's lines (`changes.jsonl`); empty when there is none. */
  async readJournal(id: string): Promise<string[]> {
    try {
      return (await readFile(this.paths.journal(id), 'utf8')).split('\n').filter((l) => l.trim())
    } catch {
      return []
    }
  }

  async appendJournal(id: string, line: string): Promise<void> {
    await ensureDir(this.paths.lesson(id))
    await appendFile(this.paths.journal(id), `${line}\n`, 'utf8')
  }

  async readGeneration(id: string): Promise<GenerationRecord | undefined> {
    return readJsonSafe<GenerationRecord>(this.paths.generation(id))
  }

  writeGeneration(id: string, record: GenerationRecord): Promise<void> {
    return atomicWriteJson(this.paths.generation(id), record)
  }

  clearGeneration(id: string): Promise<void> {
    return rm(this.paths.generation(id), { force: true })
  }

  async readThumb(id: string): Promise<Uint8Array | undefined> {
    try {
      return await readFile(this.paths.thumb(id))
    } catch {
      return undefined
    }
  }

  writeThumb(id: string, png: Uint8Array): Promise<void> {
    return writeFileAtomic(this.paths.thumb(id), png)
  }

  clearThumb(id: string): Promise<void> {
    return rm(this.paths.thumb(id), { force: true })
  }

  /** Copies lesson `from` to a new folder `to`, leaving out the top-level entries named in `skip`. */
  async copyFolder(from: string, to: string, skip: readonly string[]): Promise<void> {
    const source = this.paths.lesson(from)
    await cp(source, this.paths.lesson(to), {
      recursive: true,
      filter: (path) => !skip.includes(relative(source, path).split(sep)[0])
    })
  }
}
