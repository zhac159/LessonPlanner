/** Fixtures and a fake-clients builder for Home's tests (imported by `*.test.ts(x)` only). */
import type { ContractClient, ContractImpl } from '@shared/contract'
import type { DeckBuilderApi, LessonSummary } from '@shared/contracts/deck-builder'
import type { AiStatus, Preferences, SettingsApi } from '@shared/contracts/settings'
import type { StyleLibraryApi, StyleSummary } from '@shared/contracts/style-library'
import { createFakeClients, fakeClient, type FakeClients } from '@test/render'
import { CONNECTED } from './fixtures'

export { CONNECTED, NOT_CONNECTED, lesson, style } from './fixtures'

export interface HomeFakeOptions {
  lessons?: LessonSummary[] | Error
  styles?: StyleSummary[] | Error
  status?: AiStatus
  prefs?: Partial<Preferences>
  deckBuilder?: Partial<ContractImpl<DeckBuilderApi>>
  library?: Partial<ContractImpl<StyleLibraryApi>>
  settings?: Partial<ContractImpl<SettingsApi>>
}

export interface HomeFakes {
  clients: FakeClients
  deckBuilder: ContractClient<DeckBuilderApi>
  library: ContractClient<StyleLibraryApi>
  settings: ContractClient<SettingsApi>
}

/** Fake clients for the three modules Home reads, answering with the given data. */
export function homeFakes(options: HomeFakeOptions = {}): HomeFakes {
  const { lessons = [], styles = [], status = CONNECTED, prefs } = options
  const preferences: Preferences = {
    homeSort: 'edited',
    lastLengthMin: null,
    lastYearGroup: null,
    lastAbility: null,
    assetsMenuUses: 0,
    ...prefs
  }
  const deckBuilder = fakeClient<DeckBuilderApi>({
    listLessons: () => {
      if (lessons instanceof Error) throw lessons
      return lessons
    },
    ...options.deckBuilder
  })
  const library = fakeClient<StyleLibraryApi>({
    list: () => {
      if (styles instanceof Error) throw styles
      return styles
    },
    ...options.library
  })
  const settings = fakeClient<SettingsApi>({
    getAiStatus: () => status,
    getPreferences: () => preferences,
    setPreferences: () => {},
    ...options.settings
  })
  const clients = createFakeClients({
    'deck-builder': deckBuilder,
    'style-library': library,
    settings
  })
  return { clients, deckBuilder, library, settings }
}
