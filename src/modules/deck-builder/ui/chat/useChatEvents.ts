import { useEvent } from '@renderer/sdk'
import {
  DECK_BUILDER,
  type DeckBuilderEvents,
  type HistoryState,
  type JobKind
} from '@shared/contracts/deck-builder'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import { applyChangeSet } from '@shared/deck/apply'
import type { ChangeSet } from '@shared/deck/types'
import { errorFromEvent } from './errors'
import type { SessionContext } from './session'

type E = DeckBuilderEvents

/** The history after a new change: it is the top of the undo stack and redo is gone. */
export const historyAfter = (changeSet: ChangeSet): HistoryState => ({
  canUndo: true,
  canRedo: false,
  undoChangeSetId: changeSet.id,
  redoChangeSetId: null,
  undoSummary: changeSet.summary
})

const GENERATION_STEPS: Record<string, string> = {
  reading: 'Reading your documents…',
  planning: 'Planning the lesson…',
  writing: 'Writing the slides…'
}

/**
 * Follows a job's events (`chat:*`, `plugins:file`, `ai:error`, `gen-progress`) into the transcript, applies
 * committed changes to the deck as they land, and re-reads the lesson when the job ends (06 §6, ai-pipeline §7).
 */
export function useChatEvents(ctx: SessionContext): void {
  const { lessonId, dispatch, getState, deckRef, commit, sync } = ctx

  /** Makes sure a live turn exists (a job started elsewhere, e.g. restored after a restart). */
  const ensureLive = (kind: JobKind, messageId: string | null, pluginId?: string): void => {
    if (!getState().live) dispatch({ type: 'start', turn: { kind, messageId, pluginId } })
  }

  const end = async (error?: ChatItem['error']): Promise<void> => {
    const live = getState().live
    if (!live) return
    dispatch({ type: 'finish', error, at: new Date().toISOString() })
    const view = await sync()
    if (view && (live.changed || live.kind === 'generation')) {
      deckRef.current = view.deck
      commit({ deck: view.deck, history: view.history })
    }
  }

  useEvent<E, 'chat:delta'>(DECK_BUILDER, 'chat:delta', (e) => {
    if (e.lessonId !== lessonId) return
    ensureLive('chat', e.messageId)
    dispatch({ type: 'delta', messageId: e.messageId, text: e.text })
  })

  useEvent<E, 'chat:status'>(DECK_BUILDER, 'chat:status', (e) => {
    if (e.lessonId !== lessonId) return
    ensureLive('chat', e.messageId)
    dispatch({ type: 'status', messageId: e.messageId, step: e.step, state: e.state })
  })

  useEvent<E, 'chat:changes'>(DECK_BUILDER, 'chat:changes', (e) => {
    if (e.lessonId !== lessonId) return
    ensureLive('chat', null)
    dispatch({ type: 'changed' })
    // Slides made by generation arrive one by one through `slide-ready`; the re-read at the end settles them.
    if (getState().live?.kind === 'generation') return
    const applied = applyChangeSet(deckRef.current, e.changeSet, { allowLocked: true })
    if (applied.ok) commit({ deck: applied.deck, history: historyAfter(e.changeSet) })
  })

  useEvent<E, 'plugins:file'>(DECK_BUILDER, 'plugins:file', (e) => {
    if (e.lessonId === lessonId) dispatch({ type: 'file', file: e.file })
  })

  useEvent<E, 'chat:done'>(DECK_BUILDER, 'chat:done', (e) => {
    if (e.lessonId === lessonId) void end()
  })

  useEvent<E, 'ai:error'>(DECK_BUILDER, 'ai:error', (e) => {
    void end(errorFromEvent(e))
  })

  useEvent<E, 'gen-progress'>(DECK_BUILDER, 'gen-progress', (e) => {
    if (e.lessonId !== lessonId) return
    if (e.stage === 'done' || e.stage === 'error') return void end()
    ensureLive('generation', null)
    const step = GENERATION_STEPS[e.stage]
    const writing =
      e.total > 0 ? `Writing slide ${Math.min(e.done + 1, e.total)} of ${e.total}…` : step
    const label = e.message ?? (e.stage === 'writing' ? writing : step) ?? 'Making your slides…'
    dispatch({ type: 'progress', value: e.done, max: e.total, label, step })
  })
}
