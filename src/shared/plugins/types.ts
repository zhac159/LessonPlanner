/**
 * What a plugin's `run.ts` is given and returns (design/plugin-architecture.md §5), plus the two tiny helpers
 * plugin files use (`definePlugin`, `orThrow`). The implementation of `PluginContext` lives in
 * src/main/services/plugins.
 */
import type { Usage } from '../ai/types'
import type { StructuredRequest } from '../ai/types'
import type { DocumentKind, RegionDraft } from '../contracts/deck-builder-chat'
import type { ChangeSet, Deck, DeckOp } from '../deck/types'
import type { Failure, Result, Success } from '../result'
import type { StyleProfile } from '../style/types'
import type { PluginInputs } from './inputs'

/** What the teacher had selected in the editor when the run started (validated against the deck). */
export interface PluginSelection {
  /** The slide on the stage; always a slide of the deck. */
  currentSlideId: string
  /** Selected slides in deck order; never empty (falls back to the current slide). */
  selectedSlideIds: string[]
  regions: RegionDraft[]
}

/** The AI helper: one structured-output call. The style profile and the cancel signal are added for you. */
export interface PluginAi {
  structured<T>(
    request: Omit<StructuredRequest<T>, 'profile'>
  ): Promise<Result<{ data: T; usage: Usage }>>
}

/** A file a plugin wrote for the teacher (shown as an AttachmentCard). */
export interface SavedFile {
  name: string
  path: string
  kind: DocumentKind
}

export interface PluginContext {
  readonly pluginId: string
  readonly lessonId: string
  /** The deck as it is NOW, deeply frozen: plugins change it only through `applyChanges`. */
  readonly deck: Deck
  /** The lesson's style, or null for the plain style. */
  readonly style: StyleProfile | null
  readonly selection: PluginSelection
  readonly ai: PluginAi
  /** Aborted when the teacher presses Stop. Check it between steps. */
  readonly signal: AbortSignal
  /** Shows a step such as "Writing 10 questions…" in the chat progress card. */
  progress(step: string): void
  /** Applies ops as ONE undoable ChangeSet (`by: 'plugin'`). Failures leave the deck unchanged. */
  applyChanges(
    ops: DeckOp[],
    summary: string
  ): Promise<Result<{ changeSetId: string; changeSet: ChangeSet }>>
  /** Saves a file in the lesson's folder and shows it in the chat. */
  saveFile(name: string, bytes: Uint8Array): Promise<Result<{ file: SavedFile }>>
  /** Adds a sentence to the assistant's reply. */
  postMessage(text: string): void
  /** A fresh id, e.g. `ctx.newId('sld')`. */
  newId(prefix: string): string
}

/** What `run` may return: the summary shown in chat (and given back to the chat's `run_plugin` tool). */
export interface PluginResult {
  message?: string
}

/** What a plugin folder's `run.ts` default-exports. */
export interface PluginDefinition {
  id: string
  run(ctx: PluginContext, inputs: PluginInputs): Promise<PluginResult | void>
}

/** Typed identity helper: `export default definePlugin({ id: 'quiz', run })`. */
export const definePlugin = (definition: PluginDefinition): PluginDefinition => definition

/** Thrown by a plugin to stop with a typed failure (a Claude error, a bad input); the runner shows it as is. */
export class PluginError extends Error {
  constructor(readonly failure: Failure) {
    super(failure.message)
    this.name = 'PluginError'
  }
}

/** The success value of a Result, or throws `PluginError`: keeps plugin code linear. */
export function orThrow<T extends object>(result: Result<T>): Success<T> {
  if (!result.ok) throw new PluginError(result)
  return result
}
