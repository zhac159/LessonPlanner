/** Test helpers for the editor: a fake lesson backend that really applies ChangeSets, and a render function. Not app code. */
import type { ReactNode } from 'react'
import { act } from '@testing-library/react'
import { vi, type Mock } from 'vitest'
import type {
  DeckBuilderApi,
  DeckBuilderEvents,
  HistoryState,
  LessonView
} from '@shared/contracts/deck-builder'
import type { StyleLibraryApi, StyleSummary } from '@shared/contracts/style-library'
import { applyChangeSet } from '@shared/deck/apply'
import { fixtureDeck } from '@shared/deck/testing'
import type { Deck, DeckOp } from '@shared/deck/types'
import { fail, ok } from '@shared/result'
import {
  createFakeClients,
  fakeClient,
  renderWithApp,
  type FakeClients,
  type RenderWithAppResult
} from '@test/render'
import { ClientsProvider } from '@renderer/core/ClientsContext'
import type { ShellState } from '@renderer/core/types'
import { ToastProvider } from '@ui/overlays'
import { EditorScreen, type EditorScreenProps } from './EditorScreen'

export const LESSON = 'les_1'

/** `openLesson`'s `runningJob` for a generation or a chat turn that is already running. */
export const RUNNING_GENERATION: NonNullable<LessonView['runningJob']> = {
  jobId: 'job_gen',
  kind: 'generation',
  messageId: 'msg_1'
}
export const RUNNING_CHAT: NonNullable<LessonView['runningJob']> = {
  jobId: 'job_chat',
  kind: 'chat',
  messageId: 'msg_2'
}

/** A lesson in main's memory: applies ChangeSets for real and keeps an undo and a redo stack. */
export class FakeLesson {
  deck: Deck
  past: Deck[] = []
  future: Deck[] = []
  summaries: string[] = []
  private counter = 0

  constructor(deck: Deck = fixtureDeck()) {
    this.deck = deck
  }

  history = (): HistoryState => ({
    canUndo: this.past.length > 0,
    canRedo: this.future.length > 0,
    undoChangeSetId: this.past.length ? 'chg_undo' : null,
    redoChangeSetId: this.future.length ? 'chg_redo' : null,
    ...(this.summaries.length ? { undoSummary: this.summaries[this.summaries.length - 1] } : {})
  })

  applyOps = ({ ops, summary }: { ops: DeckOp[]; summary: string }) => {
    this.counter += 1
    const result = applyChangeSet(this.deck, {
      id: `chg_${this.counter}`,
      by: 'user',
      summary,
      ops,
      at: '2026-10-06T10:00:00.000Z'
    })
    if (!result.ok) return fail('invalid-input', result.errors.join('; '))
    this.past.push(this.deck)
    this.future = []
    this.summaries.push(summary)
    this.deck = result.deck
    return ok({ changeSet: result.changeSet, history: this.history() })
  }

  undo = () => {
    const previous = this.past.pop()
    if (!previous) return fail('invalid-input', 'Nothing to undo')
    this.future.push(this.deck)
    this.summaries.pop()
    this.deck = previous
    return ok({ deck: this.deck, history: this.history() })
  }

  redo = () => {
    const next = this.future.pop()
    if (!next) return fail('invalid-input', 'Nothing to redo')
    this.past.push(this.deck)
    this.deck = next
    return ok({ deck: this.deck, history: this.history() })
  }

  view = (patch: Partial<LessonView> = {}): LessonView => ({
    deck: this.deck,
    titleSource: 'auto',
    style: null,
    history: this.history(),
    chat: [],
    runningJob: null,
    stickyNotes: [],
    ...patch
  })
}

export interface EditorSetup {
  lesson?: FakeLesson
  /** Overrides what `openLesson` answers (a failure, a running job…). */
  open?: DeckBuilderApi['openLesson']
  deckBuilder?: Partial<DeckBuilderApi>
  props?: Partial<EditorScreenProps>
  shell?: Partial<ShellState>
  view?: Partial<LessonView>
  /** Styles the style library lists (the header's style chip). */
  styles?: StyleSummary[]
  /** More fake module clients (`assets`, `settings`), by module id. */
  clients?: Record<string, object>
}

export type DeckBuilderMock = { [K in keyof DeckBuilderApi]: Mock }

/** Renders the editor against a fake lesson. `emit` delivers deck-builder events inside `act`. */
export function setupEditor(options: EditorSetup = {}) {
  const lesson = options.lesson ?? new FakeLesson()
  const db = fakeClient<DeckBuilderApi>({
    openLesson: options.open ?? (() => ok(lesson.view(options.view))),
    applyOps: lesson.applyOps,
    undo: lesson.undo,
    redo: lesson.redo,
    renameLesson: ({ title }) => {
      lesson.deck = { ...lesson.deck, title }
      return ok({ lesson: { id: LESSON, title } as never })
    },
    setStickyNotes: () => ok(),
    exportPptx: () => ({ status: 'cancelled' }),
    finishGeneration: () => ok({ jobId: 'job_gen', messageId: 'msg_1' }),
    openExport: () => ok(),
    showExport: () => ok(),
    ...options.deckBuilder
  })
  const clients: FakeClients = createFakeClients({
    'deck-builder': db,
    'style-library': fakeClient<StyleLibraryApi>({ list: () => options.styles ?? [] }),
    ...options.clients
  })
  const props: EditorScreenProps = {
    lessonId: LESSON,
    reloadToken: 0,
    active: true,
    onBack: vi.fn(),
    onConnectClaude: vi.fn(),
    ...options.props
  }
  const utils: RenderWithAppResult = renderWithApp(<EditorScreen {...props} />, {
    clients,
    shell: options.shell
  })
  const emit = <K extends keyof DeckBuilderEvents>(event: K, payload: DeckBuilderEvents[K]): void =>
    act(() => clients.emit('deck-builder', event, payload))
  const rerenderEditor = (patch: Partial<EditorScreenProps> = {}): void =>
    utils.rerender(<EditorScreen {...props} {...patch} />)
  return {
    ...utils,
    props,
    lesson,
    db: db as unknown as DeckBuilderMock,
    emit,
    clients,
    rerenderEditor
  }
}

/** A wrapper for `renderHook`: the fake clients and the toasts the editor's hooks use. */
export function hookWrapper(clients: FakeClients) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ClientsProvider clients={clients}>
        <ToastProvider>{children}</ToastProvider>
      </ClientsProvider>
    )
  }
}
