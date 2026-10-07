/** Test helpers for the New lesson screen: fake clients with sensible answers, and a render function. */
import { vi, type Mock } from 'vitest'
import { screen } from '@testing-library/react'
import type { ContractClient } from '@shared/contract'
import { ok } from '@shared/result'
import type { DeckBuilderApi, LessonSummary, LoDocument } from '@shared/contracts/deck-builder'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'
import type { AiStatus, Preferences, SettingsApi } from '@shared/contracts/settings'
import type { StyleLibraryApi, StyleSummary } from '@shared/contracts/style-library'
import {
  createFakeClients,
  fakeClient,
  renderWithApp,
  type FakeClients,
  type RenderWithAppResult
} from '@test/render'
import { NewLessonScreen } from './NewLessonScreen'
import type { NewLessonScreenProps } from '../seams'

export const style = (patch: Partial<StyleSummary> = {}): StyleSummary => ({
  id: 'sty_science',
  name: 'Science KS3',
  isDefault: true,
  status: 'ready',
  swatches: ['#0b7a75', '#222', '#ffe36e', '#dff5d8'],
  titleFont: 'Poppins',
  deckCount: 3,
  learning: null,
  primaryHex: '#0b7a75',
  tintHex: '#d9f2ee',
  updatedAt: '2026-10-01T09:00:00Z',
  ...patch
})

export const lesson = (patch: Partial<LessonSummary> = {}): LessonSummary => ({
  id: 'les_1',
  title: 'Y8 Science — Cells',
  yearGroup: 'Year 8',
  yearShort: 'Year 8',
  slideCount: 9,
  updatedAt: '2026-10-01T09:00:00Z',
  styleId: 'sty_science',
  thumbDataUrl: null,
  status: 'ready',
  ...patch
})

export const loDocument = (patch: Partial<LoDocument> = {}): LoDocument => ({
  id: 'doc_1',
  name: 'Photosynthesis LOs.docx',
  kind: 'docx',
  sizeBytes: 24_000,
  ...patch
})

export const plugin = (patch: Partial<PluginSummary> = {}): PluginSummary => ({
  id: 'quiz',
  name: 'Quiz',
  description: 'Make a quick quiz',
  icon: 'list-checks',
  tint: 'purple-soft',
  scope: 'lesson',
  hasInputs: true,
  needsSlides: true,
  order: 1,
  ...patch
})

export const aiStatus = (patch: Partial<AiStatus> = {}): AiStatus => ({
  hasKey: true,
  keyLast4: 'abcd',
  model: 'sonnet-5.5',
  lastTest: null,
  encryptionAvailable: true,
  ...patch
})

export interface ScreenOptions {
  deckBuilder?: Partial<DeckBuilderApi>
  settings?: Partial<SettingsApi>
  library?: Partial<StyleLibraryApi>
  props?: Partial<NewLessonScreenProps>
}

export interface ScreenHarness extends RenderWithAppResult {
  clients: FakeClients
  onOpenLesson: Mock<(id: string) => void>
  onBack: Mock<() => void>
  deckBuilder: ContractClient<DeckBuilderApi>
  settings: ContractClient<SettingsApi>
}

/** Renders the screen with a connected Claude, one style and no saved preferences unless told otherwise. */
export function renderScreen(options: ScreenOptions = {}): ScreenHarness {
  const prefs: Preferences = {
    homeSort: 'edited',
    lastLengthMin: null,
    lastYearGroup: null,
    lastAbility: null,
    assetsMenuUses: 0
  }
  const deckBuilder = fakeClient<DeckBuilderApi>({
    'plugins:list': () => [],
    listLessons: () => [],
    createLesson: () => ok({ lessonId: 'les_new', jobId: 'job_1', messageId: 'msg_1' }),
    ...options.deckBuilder
  })
  const settings = fakeClient<SettingsApi>({
    getAiStatus: () => aiStatus(),
    getPreferences: () => prefs,
    setPreferences: () => {},
    ...options.settings
  })
  const library = fakeClient<StyleLibraryApi>({ list: () => [style()], ...options.library })
  const clients = createFakeClients({
    'deck-builder': deckBuilder,
    settings,
    'style-library': library
  })
  const onOpenLesson = vi.fn<(id: string) => void>()
  const onBack = vi.fn<() => void>()
  const view = renderWithApp(
    <NewLessonScreen onOpenLesson={onOpenLesson} onBack={onBack} {...options.props} />,
    { clients }
  )
  return { ...view, clients, onOpenLesson, onBack, deckBuilder, settings }
}

/** The Composer's text box. */
export const composer = (): HTMLTextAreaElement =>
  screen.getByRole('textbox', { name: 'Message your planning buddy' })

/** The "Make my slides" button. */
export const makeButton = (): HTMLElement => screen.getByRole('button', { name: 'Make my slides' })
