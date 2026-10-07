/**
 * The `PluginContext` a plugin's `run()` receives (design/plugin-architecture.md §5): the deck (read-only), the
 * style, a structured-output AI helper, progress, a cancel signal and the output helpers. One per run; it also
 * records what the run produced so the runner can report it.
 */
import { freeze } from 'immer'
import type { AiService } from '@shared/ai/types'
import type { ChangeSet, Deck } from '@shared/deck/types'
import { ok } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import type { PluginContext, PluginSelection, SavedFile } from '@shared/plugins/types'
import type { LessonsService } from '../lessons/service'
import type { EmitEvent } from '../lessons/types'

/** What a run produced so far. */
export interface RunLog {
  changeSetIds: string[]
  files: SavedFile[]
  messages: string[]
  /** The step shown as running now. */
  step: string | undefined
}

export interface ContextInput {
  pluginId: string
  usesStyle: boolean
  lessonId: string
  messageId: string
  deck: Deck
  style: StyleProfile | null
  selection: PluginSelection
  signal: AbortSignal
  lessons: LessonsService
  ai: AiService
  emit: EmitEvent
  newId: (prefix: string) => string
}

/** Builds the context and the log it fills. */
export function createContext(input: ContextInput): { ctx: PluginContext; log: RunLog } {
  const { lessonId, messageId, emit } = input
  const log: RunLog = { changeSetIds: [], files: [], messages: [], step: undefined }
  let deck = freeze(input.deck, true)

  const ctx: PluginContext = {
    pluginId: input.pluginId,
    lessonId,
    get deck() {
      return deck
    },
    style: input.style,
    selection: input.selection,
    signal: input.signal,
    ai: {
      structured: (request) =>
        input.ai.structured(
          { ...request, profile: input.usesStyle ? input.style : null },
          { signal: input.signal }
        )
    },
    progress(step) {
      if (log.step) emit('chat:status', { lessonId, messageId, step: log.step, state: 'done' })
      log.step = step
      emit('chat:status', { lessonId, messageId, step, state: 'running' })
    },
    async applyChanges(ops, summary) {
      const edited = await input.lessons.apply(lessonId, {
        by: 'plugin',
        pluginId: input.pluginId,
        summary,
        ops
      })
      if (!edited.ok) return edited
      deck = freeze(edited.deck, true)
      log.changeSetIds.push(edited.changeSet.id)
      emit('chat:changes', { lessonId, changeSet: edited.changeSet as ChangeSet })
      return ok({ changeSetId: edited.changeSet.id, changeSet: edited.changeSet })
    },
    async saveFile(name, bytes) {
      const saved = await input.lessons.files.saveOutput(lessonId, name, bytes)
      if (!saved.ok) return saved
      const file: SavedFile = { name: saved.name, path: saved.path, kind: saved.kind }
      log.files.push(file)
      emit('plugins:file', { lessonId, messageId, file })
      return ok({ file })
    },
    postMessage(text) {
      if (text.trim()) log.messages.push(text.trim())
    },
    newId: input.newId
  }
  return { ctx, log }
}
