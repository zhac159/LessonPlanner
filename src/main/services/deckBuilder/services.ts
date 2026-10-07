/**
 * Composition of the deck-builder main-process services: lessons, generation, chat, plugins. Plain
 * construction with injected ports (no Electron, no globals), so the module's `main.ts`, the dev seeds and the
 * tests all build the same object the same way.
 *
 *   lessons ── generation ── chat ── plugins        all share one ChatStore and one JobRegistry
 */
import { join } from 'node:path'
import type { AiService } from '@shared/ai/types'
import { createLogger } from '../../logger'
import { AssetPlacer } from '../chat/placer'
import { ChatService } from '../chat/service'
import { ChatStore } from '../chat/store'
import { GenerationService } from '../generation/service'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import { LessonsService } from '../lessons/service'
import type { DialogPort, EmitEvent, Logger, SlideRendererPort, TrashPort } from '../lessons/types'
import { createPluginRegistry } from '../plugins/discover'
import { PluginInputsStore } from '../plugins/inputsStore'
import type { PluginRegistry } from '../plugins/registry'
import { PluginRunner } from '../plugins/runner'
import type { StyleLookup } from './sharedStyles'

export interface DeckBuilderServicesDeps {
  /** The module's data folder (`ctx.dataDir`). */
  dir: string
  ai: AiService
  styles: StyleLookup
  dialogs: DialogPort
  /** The teacher's library (agents/ASSETS.md): placing pictures, `{{name}}` chat, generation, export credits. */
  assets?: LessonAssetsPort
  emit: EmitEvent
  renderer?: SlideRendererPort
  trash?: TrashPort
  /** Lower-case installed font names (may be filled in after start-up). */
  installedFonts?: ReadonlySet<string>
  /** Default: every plugin in `src/plugins`. */
  registry?: PluginRegistry
  clock?: () => Date
  ids?: (prefix: string) => string
  log?: Logger
  undoWindowMs?: number
}

export interface DeckBuilderServices {
  lessons: LessonsService
  generation: GenerationService
  chat: ChatService
  /** Places library, online and made pictures (`placeAsset`); undefined without a library. */
  placer: AssetPlacer | undefined
  plugins: PluginRunner
  registry: PluginRegistry
  styles: StyleLookup
  chatStore: ChatStore
  /** Stops running jobs, finishes pending deletes and thumbnails. Safe to call more than once. */
  dispose(): Promise<void>
}

/** How long `dispose` waits for a cancelled job to wind down before it gives up on it. */
const JOB_SETTLE_MS = 3000

/** Builds the services and loads the plugin registry. */
export async function createDeckBuilderServices(
  deps: DeckBuilderServicesDeps
): Promise<DeckBuilderServices> {
  const log = deps.log ?? createLogger('deck-builder')
  const lessons = new LessonsService({
    dir: deps.dir,
    styles: deps.styles,
    dialogs: deps.dialogs,
    renderer: deps.renderer,
    trash: deps.trash,
    emit: deps.emit,
    clock: deps.clock,
    ids: deps.ids,
    log,
    undoWindowMs: deps.undoWindowMs,
    installedFonts: deps.installedFonts,
    assets: deps.assets
  })
  const chatStore = new ChatStore((lessonId) => lessons.chatPath(lessonId))
  const registry = deps.registry ?? createPluginRegistry(log)
  await registry.load()
  const common = { lessons, ai: deps.ai, emit: deps.emit, clock: deps.clock, ids: deps.ids }
  const plugins = new PluginRunner({
    registry,
    lessons,
    ai: deps.ai,
    chatLog: chatStore,
    inputs: new PluginInputsStore(join(deps.dir, 'plugin-inputs.json')),
    emit: deps.emit,
    clock: deps.clock,
    ids: deps.ids,
    log
  })
  const placer = deps.assets
    ? new AssetPlacer({
        lessons,
        assets: deps.assets,
        store: chatStore,
        clock: deps.clock,
        ids: deps.ids
      })
    : undefined
  const generation = new GenerationService({ ...common, chatLog: chatStore, assets: deps.assets })
  const chat = new ChatService({
    ...common,
    store: chatStore,
    renderer: deps.renderer,
    plugins: plugins.chatBridge(),
    assets: deps.assets,
    placer
  })

  let disposed: Promise<void> | undefined
  const dispose = (): Promise<void> => {
    disposed ??= (async () => {
      const running = (await lessons.list()).filter((l) => l.status === 'generating')
      for (const lesson of running) {
        const job = lessons.jobs.running(lesson.id)
        if (!job) continue
        lessons.jobs.cancel(job.id)
        await Promise.race([job.done, new Promise((resolve) => setTimeout(resolve, JOB_SETTLE_MS))])
      }
      await lessons.flushThumbnails()
      await lessons.finalizeDeletes()
    })()
    return disposed
  }
  return {
    lessons,
    generation,
    chat,
    placer,
    plugins,
    registry,
    styles: deps.styles,
    chatStore,
    dispose
  }
}
