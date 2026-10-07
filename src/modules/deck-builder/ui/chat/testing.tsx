/** Test helpers for the editor chat: fake clients with sensible answers and a render function. Not app code. */
import { act } from '@testing-library/react'
import { vi, type Mock } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import type { Deck } from '@shared/deck/types'
import { ok } from '@shared/result'
import type {
  DeckBuilderApi,
  DeckBuilderEvents,
  HistoryState,
  LessonView
} from '@shared/contracts/deck-builder'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import type { StyleLibraryApi, StyleSummary } from '@shared/contracts/style-library'
import type { AssetsApi, AssetSummary } from '@shared/contracts/assets'
import type { ShellUser } from '@renderer/core/types'
import { fakeAssets, fakeSettings, LIBRARY } from '../assets/testing'
import {
  createFakeClients,
  fakeClient,
  type ApiOverrides,
  renderWithApp,
  type FakeClients,
  type RenderWithAppResult
} from '@test/render'
import { EditorChat } from './EditorChat'
import type { EditorChatExtras } from './types'
import type { EditorChatProps } from '../seams'

export const LESSON = 'les_1'

export const HISTORY: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoChangeSetId: null,
  redoChangeSetId: null
}

export const chatItem = (patch: Partial<ChatItem> & Pick<ChatItem, 'id' | 'role'>): ChatItem => ({
  at: '2026-10-06T09:00:00.000Z',
  text: '',
  ...patch
})

export const plugin = (patch: Partial<PluginSummary> = {}): PluginSummary => ({
  id: 'quiz',
  name: 'Quiz',
  description: 'Quick-check questions in your format',
  icon: 'list-checks',
  tint: 'peach',
  scope: 'lesson',
  hasInputs: true,
  needsSlides: true,
  order: 1,
  ...patch
})

export type ChatProps = EditorChatProps & EditorChatExtras

export interface ChatSetup {
  deckBuilder?: Partial<DeckBuilderApi>
  props?: Partial<ChatProps>
  /** Null: the shell has no user yet (keys cannot be checked). */
  user?: ShellUser | null
  /** The styles the library lists (for "Knows your … style"). */
  styles?: Partial<StyleSummary>[]
  /** Overrides for the fake `window.api` (e.g. `files.pathFor`). */
  api?: ApiOverrides
  /** What `openLesson` answers with besides the deck. */
  stored?: Partial<LessonView>
  /** The teacher's library (default: the mockups' six assets). */
  library?: AssetSummary[]
  assets?: Partial<AssetsApi>
  /** How often "Add asset" was used before (the "New" pill shows below three). */
  menuUses?: number
}

export type DeckBuilderMock = { [K in keyof DeckBuilderApi]: Mock }

/** Renders `EditorChat` with fake clients. `view` is what main would answer to `openLesson`; change it mid-test. */
export function setupChat(options: ChatSetup = {}) {
  const deck: Deck = options.props?.deck ?? fixtureDeck()
  const view: LessonView = {
    deck,
    titleSource: 'auto',
    style: null,
    history: HISTORY,
    chat: [],
    runningJob: null,
    stickyNotes: [],
    ...options.stored
  }
  const db = fakeClient<DeckBuilderApi>({
    'plugins:list': () => [],
    openLesson: () => ok(view),
    ...options.deckBuilder
  })
  const styles = fakeClient<StyleLibraryApi>({
    list: () => (options.styles ?? []) as StyleSummary[]
  })
  const assets = fakeAssets(options.library ?? LIBRARY, options.assets)
  const settings = fakeSettings(options.menuUses ?? 0)
  const clients: FakeClients = createFakeClients({
    'deck-builder': db,
    'style-library': styles,
    assets,
    settings
  })
  const props: ChatProps = {
    lessonId: LESSON,
    deck,
    style: null,
    initialChat: [],
    runningJob: null,
    selectedSlideIds: ['s1'],
    currentSlideId: 's1',
    regions: [],
    onRegionsChange: vi.fn(),
    onHighlightRegion: vi.fn(),
    onLessonChanged: vi.fn(),
    onHighlightSlides: vi.fn(),
    circleToolActive: false,
    onConnectClaude: vi.fn(),
    history: HISTORY,
    ...options.props
  }
  const user = options.user === undefined ? { name: 'Ms Rao', claudeConnected: true } : options.user
  const utils: RenderWithAppResult = renderWithApp(<EditorChat {...props} />, {
    clients,
    api: options.api,
    shell: { user }
  })
  const emit = <K extends keyof DeckBuilderEvents>(event: K, payload: DeckBuilderEvents[K]): void =>
    act(() => clients.emit('deck-builder', event, payload))
  const rerender = (patch: Partial<ChatProps>): void =>
    utils.rerender(<EditorChat {...props} {...patch} />)
  return {
    ...utils,
    props,
    view,
    db: db as unknown as DeckBuilderMock,
    assets,
    settings,
    emit,
    rerender
  }
}

export const USAGE = { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }
