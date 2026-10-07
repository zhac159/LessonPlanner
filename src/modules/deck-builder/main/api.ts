/**
 * `createDeckBuilderApi`: the whole `DeckBuilderApi` contract as one object, composed from the four areas
 * (lessons, editor, chat, plugins). Takes the services and OS ports as arguments, so tests need no Electron.
 */
import type { ContractImpl } from '@shared/contract'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { FullScreenPort, OpenerPort } from '@main/services/deckBuilder/ports'
import type { DeckBuilderServices } from '@main/services/deckBuilder/services'
import { createChatApi, createPluginsApi } from './chatApi'
import { createEditorApi } from './editorApi'
import { createLessonsApi } from './lessonsApi'

export interface DeckBuilderApiDeps {
  services: DeckBuilderServices
  /** The module's data folder (`ctx.dataDir`). */
  dir: string
  opener: OpenerPort
  fullScreen: FullScreenPort
}

/** Every method of the contract, as own properties (what `serveContract` registers). */
export function createDeckBuilderApi(deps: DeckBuilderApiDeps): ContractImpl<DeckBuilderApi> {
  return {
    ...createLessonsApi(deps.services),
    ...createEditorApi(deps),
    ...createChatApi(deps.services),
    ...createPluginsApi(deps.services)
  }
}
