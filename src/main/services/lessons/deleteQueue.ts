/**
 * Deleting a lesson with an undo window. The lesson folder is first MOVED to `deleted/<id>` (it vanishes from
 * Home at once and can be brought back); when the window ends it goes to the Recycle Bin (`shell.trashItem`,
 * 03 §6). Folders left behind by a crash are finalised the next time the app starts (`finalizeAll`).
 */
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { isSafeId, type LessonPaths } from './paths'
import type { Logger, TrashPort } from './types'

export const DEFAULT_UNDO_WINDOW_MS = 10_000

const RENAME_ATTEMPTS = 6

/** Renaming a folder fails briefly on Windows while a file inside is still being written or scanned. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const transient = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!transient || attempt >= RENAME_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 40 * attempt))
    }
  }
}

export class DeleteQueue {
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly paths: LessonPaths,
    private readonly deps: { trash: TrashPort | undefined; windowMs: number; log: Logger }
  ) {}

  private pathOf = (id: string): string => join(this.paths.deleted, id)

  /** Moves the lesson out of the way and starts the undo window. */
  async stage(id: string): Promise<void> {
    await mkdir(this.paths.deleted, { recursive: true })
    await rm(this.pathOf(id), { recursive: true, force: true })
    await renameWithRetry(this.paths.lesson(id), this.pathOf(id))
    const timer = setTimeout(() => void this.finalize(id), this.deps.windowMs)
    timer.unref()
    this.timers.set(id, timer)
  }

  /** Brings a lesson back while its window is open. False when it is not waiting any more. */
  async restore(id: string): Promise<boolean> {
    if (!this.timers.has(id)) return false
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    try {
      await renameWithRetry(this.pathOf(id), this.paths.lesson(id))
      return true
    } catch (error) {
      this.deps.log.error(`Could not restore lesson ${id}: ${String(error)}`)
      return false
    }
  }

  /** Ids waiting inside their undo window. */
  get pending(): string[] {
    return [...this.timers.keys()]
  }

  /** Ends the window for every deleted lesson now, including folders left by an earlier run. */
  async finalizeAll(): Promise<void> {
    let leftovers: string[] = []
    try {
      leftovers = (await readdir(this.paths.deleted)).filter(isSafeId)
    } catch {
      // nothing deleted yet
    }
    await Promise.all(
      [...new Set([...this.timers.keys(), ...leftovers])].map((id) => this.finalize(id))
    )
  }

  private async finalize(id: string): Promise<void> {
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    const path = this.pathOf(id)
    try {
      if (this.deps.trash) await this.deps.trash.trashItem(path)
      else await rm(path, { recursive: true, force: true })
    } catch (error) {
      this.deps.log.error(`Could not move lesson ${id} to the Recycle Bin: ${String(error)}`)
    }
  }
}
