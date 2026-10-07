/**
 * Writes the seed lessons through the real LessonsService (so index, thumbnails and files are exactly what the
 * app writes), then forgets the undo history of the seeding itself: Undo in a seeded lesson must not empty it.
 */
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Deck, Paragraph, TextElement } from '@shared/deck/types'
import { newId } from '@shared/ids'
import type { StyleProfile } from '@shared/style/types'
import type { ChatRecord } from '../services/chat/records'
import { ChatStore } from '../services/chat/store'
import { LessonsService } from '../services/lessons/service'
import { LessonPaths } from '../services/lessons/paths'
import { silentLogger, type Logger, type SlideRendererPort } from '../services/lessons/types'
import {
  deckFor,
  editedAt,
  FORM_STYLE_ID,
  GENERATING_LESSON,
  PHOTOSYNTHESIS_ID,
  SCIENCE_STYLE_ID,
  SEED_LESSONS,
  type SeedLesson
} from './seedData'

export const deckBuilderDir = (dataRoot: string): string =>
  join(dataRoot, 'modules', 'deck-builder')

export interface SeedLessonsOptions {
  dataRoot: string
  baseDeck: Deck
  /** Profiles by id, for thumbnails. */
  styles: ReadonlyMap<string, StyleProfile>
  renderer?: SlideRendererPort
  now: Date
  /** Also write a short chat history (with a ResultChip) into the photosynthesis lesson. */
  chat?: boolean
  /** Also write the lesson of the "generating" seed. */
  generating?: boolean
  log?: Logger
  /**
   * Called with the pending thumbnail work instead of waiting for it. The Electron app uses this so that no
   * render window opens before the main window (automation takes the first window it sees as the app).
   */
  onThumbnails?: (done: Promise<void>) => void
}

const styleIdOf = (lesson: SeedLesson): string =>
  lesson.style === 'form' ? FORM_STYLE_ID : SCIENCE_STYLE_ID

/** Creates every seed lesson and returns their ids, newest first. */
export async function writeSeedLessons(options: SeedLessonsOptions): Promise<string[]> {
  const dir = deckBuilderDir(options.dataRoot)
  let at = options.now
  let nextId: string | undefined
  const service = new LessonsService({
    dir,
    styles: { getProfile: async (id) => options.styles.get(id) },
    dialogs: { pickSavePath: async () => undefined, pickOpenPath: async () => undefined },
    renderer: options.renderer,
    clock: () => at,
    ids: (prefix) => (prefix === 'les' && nextId ? nextId : newId(prefix)),
    log: options.log ?? silentLogger
  })
  const paths = new LessonPaths(dir)
  const lessons = [...SEED_LESSONS, ...(options.generating ? [GENERATING_LESSON] : [])]
  for (const lesson of lessons) {
    at = editedAt(options.now, lesson)
    nextId = lesson.id
    const { meta, slides } = deckFor(options.baseDeck, lesson)
    const created = await service.create({ title: lesson.title, styleId: styleIdOf(lesson), meta })
    if (!created.ok) throw new Error(`Seed lesson "${lesson.title}": ${created.message}`)
    if (slides.length > 0) {
      const inserted = await service.apply(lesson.id, {
        by: 'user',
        summary: 'Seed slides',
        ops: [{ op: 'insertSlides', afterSlideId: null, slides }]
      })
      if (!inserted.ok) throw new Error(`Seed slides "${lesson.title}": ${inserted.message}`)
    }
    await rm(paths.journal(lesson.id), { force: true })
  }
  nextId = undefined
  if (options.chat)
    await writeSeedChat(service, new ChatStore((id) => service.chatPath(id)), options.now)
  if (options.generating)
    await writeGeneratingChat(new ChatStore((id) => service.chatPath(id)), options.now)
  const thumbnails = service.flushThumbnails()
  if (options.onThumbnails) options.onThumbnails(thumbnails)
  else await thumbnails
  return lessons.map((l) => l.id)
}

const record = (
  id: string,
  role: ChatRecord['role'],
  at: Date,
  ui: ChatRecord['ui']
): ChatRecord => ({ id, role, at: at.toISOString(), ui, api: [] })

const minutesBefore = (now: Date, minutes: number): Date =>
  new Date(now.getTime() - minutes * 60_000)

/** A short conversation on the photosynthesis lesson ending with an AI change (a ResultChip with Undo). */
async function writeSeedChat(service: LessonsService, chat: ChatStore, now: Date): Promise<void> {
  const context = await service.context(PHOTOSYNTHESIS_ID)
  if (!context.ok) throw new Error(context.message)
  const slide = context.deck.slides[2]
  const body = slide.elements.find((e): e is TextElement => e.type === 'text' && e.role === 'body')
  if (!body) throw new Error('The photosynthesis fixture has no body text on slide 3')
  const shorter: Paragraph[] = body.paragraphs.slice(0, 3).map((p) => ({
    ...p,
    runs: p.runs.map((run) => ({ ...run, text: run.text.split(/\s+/).slice(0, 8).join(' ') }))
  }))
  const edited = await service.apply(PHOTOSYNTHESIS_ID, {
    by: 'ai',
    summary: 'Shortened the text on slide 3',
    ops: [
      { op: 'updateElement', slideId: slide.id, elementId: body.id, set: { paragraphs: shorter } }
    ]
  })
  if (!edited.ok) throw new Error(edited.message)
  const lines: ChatRecord[] = [
    record('msg_seed_1', 'user', minutesBefore(now, 12), {
      text: 'Is slide 3 too wordy for Year 8?'
    }),
    record('msg_seed_2', 'assistant', minutesBefore(now, 12), {
      text: 'It’s the busiest slide in the lesson. I can cut it down to three short points if you like.'
    }),
    record('msg_seed_3', 'user', minutesBefore(now, 10), { text: 'Yes please, shorten slide 3.' }),
    record('msg_seed_4', 'assistant', minutesBefore(now, 10), {
      text: 'Done. I’ve made that text shorter and kept the key words.',
      changeSetIds: [edited.changeSet.id]
    })
  ]
  for (const line of lines) await chat.append(PHOTOSYNTHESIS_ID, line)
}

/** The teacher's request that the generating lesson is working on. */
async function writeGeneratingChat(chat: ChatStore, now: Date): Promise<void> {
  await chat.append(
    GENERATING_LESSON.id,
    record('msg_seed_gen_1', 'user', now, {
      text: 'Year 8 Science: the water cycle\nLO1: Describe evaporation and condensation'
    })
  )
}
