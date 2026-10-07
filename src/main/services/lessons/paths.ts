/**
 * Where lesson files live (design/deck-model.md §7), relative to the module's data folder:
 *   lessons/<id>/{deck.json, changes.jsonl, chat.jsonl, lesson.json, generation.json, thumb.png, assets/, outputs/}
 *   index.json   inbox/   deleted/
 */
import { join } from 'node:path'

/** Lesson and asset ids become folder and file names: letters, digits, `_` and `-` only. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

export const isSafeId = (id: unknown): id is string => typeof id === 'string' && SAFE_ID.test(id)

export class LessonPaths {
  readonly lessons: string
  readonly index: string
  /** LO documents attached before their lesson exists. */
  readonly inbox: string
  /** Lessons deleted but still inside the undo window. */
  readonly deleted: string

  constructor(readonly root: string) {
    this.lessons = join(root, 'lessons')
    this.index = join(root, 'index.json')
    this.inbox = join(root, 'inbox')
    this.deleted = join(root, 'deleted')
  }

  lesson = (id: string): string => join(this.lessons, id)
  deck = (id: string): string => join(this.lesson(id), 'deck.json')
  journal = (id: string): string => join(this.lesson(id), 'changes.jsonl')
  chat = (id: string): string => join(this.lesson(id), 'chat.jsonl')
  state = (id: string): string => join(this.lesson(id), 'lesson.json')
  generation = (id: string): string => join(this.lesson(id), 'generation.json')
  thumb = (id: string): string => join(this.lesson(id), 'thumb.png')
  assets = (id: string): string => join(this.lesson(id), 'assets')
  outputs = (id: string): string => join(this.lesson(id), 'outputs')
}
