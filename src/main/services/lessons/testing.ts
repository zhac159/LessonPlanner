/** Test-only builders for the lessons services: temp folders, fake ports, a ready-made service. */
import { mkdtempSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import type { Deck } from '@shared/deck/types'
import { fixtureStyle } from '@shared/deck/testing'
import type { StyleProfile } from '@shared/style/types'
import { LessonsService } from './service'
import type {
  DialogPort,
  LessonsServiceDeps,
  SlideRenderRequest,
  SlideRendererPort,
  StyleSource,
  TrashPort
} from './types'

const dirs: string[] = []

/** A fresh temp folder, removed after the test. */
export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slide-planner-'))
  dirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(
    dirs
      .splice(0)
      .map((d) => rm(d, { recursive: true, force: true, maxRetries: 8, retryDelay: 50 }))
  )
})

/** Writes a small file and returns its path (for imports). */
export async function writeTemp(name: string, content: string | Uint8Array = 'x'): Promise<string> {
  const path = join(tempDir(), name)
  await writeFile(path, content)
  return path
}

/** Sequential ids: `les_1`, `sld_2`… (the counter is shared by all prefixes). */
export function sequentialIds(): (prefix: string) => string {
  let n = 0
  return (prefix) => `${prefix}_${++n}`
}

/** A clock that moves one second per reading. */
export function steppingClock(start = '2026-10-06T09:00:00.000Z'): () => Date {
  let t = Date.parse(start) - 1000
  return () => new Date((t += 1000))
}

export const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])

export class FakeRenderer implements SlideRendererPort {
  readonly calls: SlideRenderRequest[] = []
  failWith: Error | undefined
  /** While set, renders wait for it (to hold a render in flight). */
  gate: Promise<void> | undefined
  async renderSlidePng(request: SlideRenderRequest): Promise<Uint8Array> {
    this.calls.push(request)
    await this.gate
    if (this.failWith) throw this.failWith
    return PNG_BYTES
  }
}

export class FakeDialogs implements DialogPort {
  savePath: string | undefined
  openPath: string | undefined
  readonly saveNames: string[] = []
  async pickSavePath(defaultName: string): Promise<string | undefined> {
    this.saveNames.push(defaultName)
    return this.savePath
  }
  async pickOpenPath(): Promise<string | undefined> {
    return this.openPath
  }
}

export class FakeTrash implements TrashPort {
  readonly trashed: string[] = []
  async trashItem(path: string): Promise<void> {
    this.trashed.push(path)
  }
}

/** Serves profiles by id from a map. */
export function styleSource(...profiles: StyleProfile[]): StyleSource {
  const byId = new Map(profiles.map((p) => [p.id, p]))
  return { getProfile: async (id) => byId.get(id) }
}

export interface Rig {
  service: LessonsService
  dir: string
  renderer: FakeRenderer
  dialogs: FakeDialogs
  trash: FakeTrash
  style: StyleProfile
  /** Every `lessonsChanged` payload, in order. */
  changed: LessonSummary[][]
}

/** A LessonsService on a temp folder with fake ports and the Science KS3 fixture style. */
export function makeRig(over: Partial<LessonsServiceDeps> = {}): Rig {
  const dir = over.dir ?? tempDir()
  const style = fixtureStyle()
  const renderer = new FakeRenderer()
  const dialogs = new FakeDialogs()
  const trash = new FakeTrash()
  const changed: LessonSummary[][] = []
  const service = new LessonsService({
    dir,
    styles: styleSource(style),
    dialogs,
    renderer,
    trash,
    clock: steppingClock(),
    ids: sequentialIds(),
    emit: (name, payload) => {
      if (name === 'lessonsChanged') changed.push(payload as LessonSummary[])
    },
    undoWindowMs: 60_000,
    ...over
  })
  return { service, dir, renderer, dialogs, trash, style, changed }
}

/** Creates a lesson from the photosynthesis fixture deck: returns its id. */
export async function seedLesson(rig: Rig, deck: Deck): Promise<string> {
  const created = await rig.service.create({
    styleId: rig.style.id,
    meta: deck.meta,
    title: deck.title
  })
  if (!created.ok) throw new Error(created.message)
  const slides = await rig.service.apply(created.lessonId, {
    by: 'user',
    summary: 'Seed slides',
    ops: [{ op: 'insertSlides', afterSlideId: null, slides: deck.slides }]
  })
  if (!slides.ok) throw new Error(slides.message)
  return created.lessonId
}
