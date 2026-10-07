/** The `ChatApi` and `PluginsApi` halves of the deck-builder contract (06 Editor chat, 07 Plugin sheet). */
import type { ContractImpl } from '@shared/contract'
import type { ChatApi } from '@shared/contracts/deck-builder-chat'
import type { PluginsApi } from '@shared/contracts/deck-builder-plugins'
import type { DeckBuilderServices } from '@main/services/deckBuilder/services'

/** Chat turns, cancel and attachments. */
export function createChatApi(s: DeckBuilderServices): ContractImpl<ChatApi> {
  return {
    'chat:send': (args) => s.chat.send(args),
    'chat:cancel': ({ jobId }) => {
      s.chat.cancel(jobId)
    },
    'chat:attach': ({ lessonId }) => s.chat.attach(lessonId),
    'chat:attachPath': ({ lessonId, path }) => s.chat.attachPath(lessonId, path)
  }
}

/** The "+" menu, the options sheet and plugin runs. */
export function createPluginsApi(s: DeckBuilderServices): ContractImpl<PluginsApi> {
  return {
    'plugins:list': () => s.plugins.list(),
    'plugins:getManifest': ({ pluginId }) => s.plugins.getManifest(pluginId),
    'plugins:run': (args) => s.plugins.run(args),
    'plugins:cancel': ({ jobId }) => {
      s.plugins.cancel(jobId)
    }
  }
}
