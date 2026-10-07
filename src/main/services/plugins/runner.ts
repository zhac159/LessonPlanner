/**
 * `PluginRunner`: runs a plugin for the "+" menu (a job with chat events) or for the chat's `run_plugin` tool
 * (inside the chat turn's own job). It validates the inputs against the manifest and the selection against the
 * deck again (the renderer is not trusted), gives the plugin its context, and turns whatever happens into events
 * and a stored chat message. A plugin that throws never takes the app down.
 */
import { cancelledFailure, isRetryable } from '@shared/ai/errors'
import { EMPTY_USAGE } from '@shared/ai/prices'
import type { AiService } from '@shared/ai/types'
import type {
  PluginManifestView,
  PluginRunContext,
  PluginSummary
} from '@shared/contracts/deck-builder-plugins'
import type { StartedJob } from '@shared/contracts/deck-builder-chat'
import type { Deck } from '@shared/deck/types'
import { newId } from '@shared/ids'
import { validateInputs, type PluginInputs } from '@shared/plugins/inputs'
import { normaliseSelection } from '@shared/plugins/slideRange'
import { PluginError, type PluginSelection } from '@shared/plugins/types'
import { fail, ok, type Failure, type Result } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { errorOf, toAiErrorCode } from '../chat/errors'
import type { ChatRecord } from '../chat/records'
import type { ChatPluginBridge, PluginReport } from '../chat/service'
import type { ChatLog } from '../chat/store'
import type { LessonsService } from '../lessons/service'
import type { EmitEvent, Logger } from '../lessons/types'
import { silentLogger } from '../lessons/types'
import { createContext, type RunLog } from './context'
import type { PluginInputsStore } from './inputsStore'
import type { PluginRegistry } from './registry'

export interface PluginRunnerDeps {
  registry: PluginRegistry
  lessons: LessonsService
  ai: AiService
  chatLog: ChatLog
  inputs: PluginInputsStore
  emit: EmitEvent
  clock?: () => Date
  ids?: (prefix: string) => string
  log?: Logger
}

export interface RunArgs {
  pluginId: string
  lessonId: string
  inputs: Record<string, unknown>
  context: PluginRunContext
}

const UNEXPECTED = 'The plugin stopped unexpectedly. Nothing else was changed.'
const NEEDS_SLIDES = 'Make your slides first.'

/** A run that passed validation. */
interface Prepared {
  pluginId: string
  inputs: PluginInputs
  deck: Deck
  style: StyleProfile | null
  selection: PluginSelection
}

interface Finished {
  failure?: Failure
  message?: string
  log: RunLog
}

export class PluginRunner {
  private readonly clock: () => Date
  private readonly ids: (prefix: string) => string
  private readonly log: Logger

  constructor(private readonly deps: PluginRunnerDeps) {
    this.clock = deps.clock ?? (() => new Date())
    this.ids = deps.ids ?? newId
    this.log = deps.log ?? silentLogger
  }

  // ---- the "+" menu and the options sheet

  /** The plugins for the "+" menu, in display order. */
  list(): PluginSummary[] {
    return this.deps.registry.list()
  }

  /** The manifest for the options sheet with the options last used. */
  async getManifest(
    pluginId: string
  ): Promise<Result<{ manifest: PluginManifestView; lastInputs: Record<string, unknown> | null }>> {
    const manifest = this.deps.registry.view(pluginId)
    if (!manifest) return fail('not-found', 'That plugin isn’t available.')
    return ok({ manifest, lastInputs: await this.deps.inputs.get(pluginId) })
  }

  // ---- running as a job

  /** Starts a plugin run as a job: progress and results arrive as chat events, the message is stored. */
  async run(args: RunArgs): Promise<Result<StartedJob>> {
    const prepared = await this.prepare(args)
    if (!prepared.ok) return prepared
    const started = this.deps.lessons.jobs.start(args.lessonId, 'plugin', this.ids('msg'))
    if (!started.ok) return started
    const { job } = started
    await this.deps.inputs.set(args.pluginId, prepared.run.inputs)
    this.deps.lessons.jobs.attach(job, () =>
      this.execute(prepared.run, args.lessonId, job.messageId, job.signal)
    )
    return ok({ jobId: job.id, messageId: job.messageId })
  }

  /** Stops a running plugin job. */
  cancel(jobId: string): void {
    this.deps.lessons.jobs.cancel(jobId)
  }

  /** Resolves when the job has finished (for tests and shutdown). */
  async whenDone(jobId: string): Promise<void> {
    await this.deps.lessons.jobs.get(jobId)?.done
  }

  /** What the chat's `run_plugin` and `list_plugins` tools reach. */
  chatBridge(): ChatPluginBridge {
    return {
      list: () =>
        this.deps.registry.list().map((s) => ({ ...s, manifest: this.deps.registry.view(s.id) })),
      run: (args) => this.runInline(args)
    }
  }

  /**
   * Runs a plugin on behalf of the chat with its default options, inside the chat turn's job. Returns what Claude
   * is told: a short summary, or the reason it failed.
   */
  private async runInline(args: {
    lessonId: string
    pluginId: string
    inputs: Record<string, unknown>
    currentSlideId: string
    signal: AbortSignal
    messageId: string
    report: PluginReport
  }): Promise<unknown> {
    const prepared = await this.prepare({
      pluginId: args.pluginId,
      lessonId: args.lessonId,
      inputs: args.inputs,
      context: { currentSlideId: args.currentSlideId, selectedSlideIds: [args.currentSlideId] }
    })
    if (!prepared.ok) return { ok: false, error: prepared.message }
    const finished = await this.finish(prepared.run, args.lessonId, args.messageId, args.signal)
    finished.log.changeSetIds.forEach((id) => args.report.change(id))
    finished.log.files.forEach((file) => args.report.file(file))
    return finished.failure
      ? { ok: false, error: finished.failure.message }
      : {
          ok: true,
          summary: this.text(finished) || 'Done.',
          changes: finished.log.changeSetIds.length
        }
  }

  // ---- internals

  private async prepare(args: RunArgs): Promise<Result<{ run: Prepared }>> {
    const plugin = this.deps.registry.get(args.pluginId)
    if (!plugin) return fail('not-found', 'That plugin isn’t available.')
    const validated = validateInputs(plugin.manifest, args.inputs)
    if (!validated.ok) return validated
    const context = await this.deps.lessons.context(args.lessonId)
    if (!context.ok) return context
    if (plugin.manifest.needsSlides && context.deck.slides.length === 0)
      return fail('invalid-input', NEEDS_SLIDES)
    const selection: PluginSelection = {
      ...normaliseSelection(context.deck, args.context),
      regions: (args.context.regions ?? []).filter((r) =>
        context.deck.slides.some((s) => s.id === r.slideId)
      )
    }
    return ok({
      run: {
        pluginId: args.pluginId,
        inputs: validated.inputs,
        deck: context.deck,
        style: context.style,
        selection
      }
    })
  }

  /** Runs the plugin, catching everything; the result says how it ended. */
  private async finish(
    run: Prepared,
    lessonId: string,
    messageId: string,
    signal: AbortSignal
  ): Promise<Finished> {
    const plugin = this.deps.registry.get(run.pluginId)
    const { ctx, log } = createContext({
      pluginId: run.pluginId,
      usesStyle: plugin?.manifest.usesStyle ?? true,
      lessonId,
      messageId,
      deck: run.deck,
      style: run.style,
      selection: run.selection,
      signal,
      lessons: this.deps.lessons,
      ai: this.deps.ai,
      emit: this.deps.emit,
      newId: this.ids
    })
    try {
      if (!plugin) throw new PluginError(fail('not-found', 'That plugin isn’t available.'))
      const result = await plugin.definition.run(ctx, run.inputs)
      if (signal.aborted) return { failure: cancelledFailure(), log }
      return { message: result?.message, log }
    } catch (error) {
      if (signal.aborted) return { failure: cancelledFailure(), log }
      if (error instanceof PluginError) return { failure: error.failure, log }
      this.log.error(`Plugin ${run.pluginId} failed: ${String(error)}`)
      return { failure: fail('unknown', UNEXPECTED), log }
    }
  }

  private text(finished: Finished): string {
    return [...finished.log.messages, ...(finished.message ? [finished.message] : [])].join('\n')
  }

  /** The job body: run, store the message, tell the UI. */
  private async execute(
    run: Prepared,
    lessonId: string,
    messageId: string,
    signal: AbortSignal
  ): Promise<void> {
    const finished = await this.finish(run, lessonId, messageId, signal)
    const { log } = finished
    const failure =
      finished.failure?.code === 'cancelled' && log.changeSetIds.length > 0
        ? { ...finished.failure, message: 'Stopped. The changes already made were kept.' }
        : finished.failure
    const { emit } = this.deps
    if (log.step)
      emit('chat:status', {
        lessonId,
        messageId,
        step: log.step,
        state: failure ? 'error' : 'done'
      })
    const text = failure ? '' : this.text(finished) || 'Done.'
    const record: ChatRecord = {
      id: messageId,
      role: 'assistant',
      at: this.clock().toISOString(),
      ui: {
        text,
        pluginId: run.pluginId,
        ...(log.changeSetIds.length ? { changeSetIds: log.changeSetIds } : {}),
        ...(log.files[0] ? { file: log.files[0] } : {}),
        ...(failure ? { error: errorOf(failure, 'plugin') } : {})
      },
      api: []
    }
    try {
      await this.deps.chatLog.append(lessonId, record)
    } catch (error) {
      this.log.warn(`Could not store the plugin message: ${String(error)}`)
    }
    if (!failure) {
      emit('chat:delta', { lessonId, messageId, text })
      emit('chat:done', { lessonId, messageId, usage: { ...EMPTY_USAGE } })
    } else if (failure.code === 'cancelled') {
      emit('chat:done', { lessonId, messageId, usage: { ...EMPTY_USAGE } })
    } else {
      emit('ai:error', {
        scope: 'plugin',
        code: toAiErrorCode(failure.code),
        message: failure.message,
        retryable: isRetryable(failure.code) || failure.code === 'invalid-input'
      })
    }
  }
}
