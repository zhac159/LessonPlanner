/** The `EditorApi` half of the deck-builder contract (06 Editor): open, edit, undo, export, present. */
import type { ContractImpl } from '@shared/contract'
import type { EditorApi } from '@shared/contracts/deck-builder'
import type { FullScreenPort, OpenerPort } from '@main/services/deckBuilder/ports'
import type { DeckBuilderServices } from '@main/services/deckBuilder/services'
import { fail, ok } from '@shared/result'
import { mayOpen } from './outputAccess'

const NOT_OURS = 'That file wasn’t made by Slide Planner, so it can’t be opened from here.'

export interface EditorApiDeps {
  services: DeckBuilderServices
  /** The module's data folder (`ctx.dataDir`). */
  dir: string
  opener: OpenerPort
  fullScreen: FullScreenPort
}

/** Implements opening a lesson with its style and chat, direct edits, undo/redo, notes, export and present. */
export function createEditorApi({
  services: s,
  dir,
  opener,
  fullScreen
}: EditorApiDeps): ContractImpl<EditorApi> {
  const rules = { dir, wasExported: (path: string): boolean => s.lessons.wasExported(path) }
  return {
    async openLesson({ lessonId }) {
      const opened = await s.lessons.open(lessonId)
      if (!opened.ok) return opened
      const [style, chat] = await Promise.all([
        s.styles.viewOf(opened.deck.styleId),
        s.chat.history(lessonId)
      ])
      return ok({
        deck: opened.deck,
        titleSource: opened.titleSource,
        style,
        history: opened.history,
        chat,
        runningJob: opened.runningJob,
        stickyNotes: opened.stickyNotes
      })
    },
    async applyOps({ lessonId, ops, summary }) {
      const edited = await s.lessons.apply(lessonId, { by: 'user', summary, ops })
      return edited.ok ? ok({ changeSet: edited.changeSet, history: edited.history }) : edited
    },
    async undo({ lessonId }) {
      const edited = await s.lessons.undo(lessonId)
      return edited.ok ? ok({ deck: edited.deck, history: edited.history }) : edited
    },
    async redo({ lessonId }) {
      const edited = await s.lessons.redo(lessonId)
      return edited.ok ? ok({ deck: edited.deck, history: edited.history }) : edited
    },
    setStickyNotes: ({ lessonId, notes }) => s.lessons.setStickyNotes(lessonId, notes),
    placeAsset: async (args) =>
      s.placer
        ? s.placer.placeAsset(args)
        : fail('not-found', 'Your assets are not available right now.'),
    exportPptx: ({ lessonId, ignoreSpots }) =>
      s.lessons.exportPptx(lessonId, { ignoreSpots: ignoreSpots === true }),
    async openExport({ path }) {
      if (!mayOpen(path, rules)) return fail('invalid-input', NOT_OURS)
      const problem = await opener.openPath(path)
      return problem ? fail('io', `The file could not be opened: ${problem}`) : ok()
    },
    async showExport({ path }) {
      if (!mayOpen(path, rules)) return fail('invalid-input', NOT_OURS)
      opener.showItemInFolder(path)
      return ok()
    },
    present: ({ on }) => {
      fullScreen.setFullScreen(on === true)
    }
  }
}
