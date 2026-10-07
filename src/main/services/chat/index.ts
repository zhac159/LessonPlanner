/** Public API of the chat service. */
export {
  ChatService,
  MAX_ATTACHMENTS,
  effortFor,
  type ChatPluginBridge,
  type ChatServiceDeps,
  type PluginReport
} from './service'
export { ChatStore, type ChatLog } from './store'
export type { ChatRecord } from './records'
export { AssetPlacer, type PlacerDeps, type Placed, type PlaceRequest } from './placer'
