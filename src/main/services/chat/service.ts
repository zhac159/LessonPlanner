/**
 * `ChatService`: the editor chat (design/screens/06-editor.md §8.5, ai-pipeline.md §5-§8).
 *
 * `send` starts a job and returns at once; the turn runs in the background and reports through events
 * (`chat:status`, `chat:delta`, `chat:changes`, `chat:done`, `ai:error`). Claude edits the deck only through the
 * `applyOps` port below, i.e. as validated ChangeSets (`by: 'ai'`) on the lessons service, each one undo step.
 * Messages are appended to `chat.jsonl`; the raw Claude messages are replayed verbatim on the next turn.
 */
import type { AiService, ChatPlugins, ChatSink, ChatTurnInput, Effort } from '@shared/ai/types'
import { countPictureSpots } from '@shared/assets/spots'
import type { ChatAssetRef } from '@shared/assets/types'
import type { HistoryState } from '@shared/contracts/deck-builder'
import type {
  AttachmentRef,
  ChatItem,
  ChatSendArgs,
  StartedJob
} from '@shared/contracts/deck-builder-chat'
import { deckOutline } from '@shared/deck/outline'
import type { ChangeSet, Deck, DeckOp } from '@shared/deck/types'
import { newId } from '@shared/ids'
import { fail, ok, type Result } from '@shared/result'
import type { SavedFile } from '@shared/plugins/types'
import type { StyleProfile } from '@shared/style/types'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import type { Job } from '../lessons/jobs'
import type { LessonsService } from '../lessons/service'
import type { EmitEvent, SlideRendererPort } from '../lessons/types'
import { AssistantTokenGate, libraryOf, resolveMessageAssets } from './assetTokens'
import { changeSetIdsOf, toChatItem } from './items'
import type { AssetPlacer } from './placer'
import { FULL_HEIGHT, FULL_WIDTH, MAX_REGIONS, describeRegions, renderRegions } from './regions'
import { TurnReporter, type TurnOutcome } from './reporter'
import type { ChatStore } from './store'
import { chatAssetsFor } from './turnAssets'

export const MAX_ATTACHMENTS = 3

/** What the chat's `run_plugin` and `list_plugins` tools reach (implemented by the plugin runner). */
export interface ChatPluginBridge {
  list(): unknown
  /** Runs a plugin with the given inputs inside the chat turn's job; resolves to a summary for Claude. */
  run(args: {
    lessonId: string
    pluginId: string
    inputs: Record<string, unknown>
    currentSlideId: string
    signal: AbortSignal
    messageId: string
    /** Tells the chat what the plugin produced, so the message shows its ResultChip and file card. */
    report: PluginReport
  }): Promise<unknown>
}

export interface PluginReport {
  change(changeSetId: string): void
  file(file: SavedFile): void
}

export interface ChatServiceDeps {
  lessons: LessonsService
  ai: AiService
  store: ChatStore
  /** Draws slides for `view_slide` and for circled regions. */
  renderer?: SlideRendererPort
  plugins?: ChatPluginBridge
  /** The teacher's library and the placer: with both, `{{name}}` tokens, `list_assets` and `place_asset` work. */
  assets?: LessonAssetsPort
  placer?: AssetPlacer
  emit: EmitEvent
  clock?: () => Date
  ids?: (prefix: string) => string
}

const WHOLE_LESSON =
  /\b(redo|rewrite|rebuild|redesign|start (?:again|over))\b.*\b(whole|entire|all|lesson|deck|slides)\b/i

/** "Redo the whole lesson" gets more thinking than an ordinary edit. */
export const effortFor = (text: string): Effort | undefined =>
  WHOLE_LESSON.test(text) ? 'high' : undefined

type ChatInput = Parameters<AiService['chatTurn']>[0]

/** Everything one turn works from. */
interface Turn {
  args: ChatSendArgs
  text: string
  attachments: AttachmentRef[]
  deck: Deck
  style: StyleProfile | null
  job: Job
  /** The assets her message names (checked against the library when it was sent). */
  assetRefs: ChatAssetRef[]
}

export class ChatService {
  private readonly ids: (prefix: string) => string
  private readonly reporter: TurnReporter

  constructor(private readonly deps: ChatServiceDeps) {
    this.ids = deps.ids ?? newId
    this.reporter = new TurnReporter({
      store: deps.store,
      emit: deps.emit,
      clock: deps.clock ?? (() => new Date()),
      ids: this.ids
    })
  }

  // ---- history

  /** The conversation as the ChatPanel shows it, with ResultChips derived from the lesson's journal. */
  async history(lessonId: string): Promise<ChatItem[]> {
    const records = await this.deps.store.read(lessonId)
    const [changes, context] = await Promise.all([
      this.deps.lessons.changes(lessonId, changeSetIdsOf(records)),
      this.deps.lessons.context(lessonId)
    ])
    const slideIds = context.ok ? context.deck.slides.map((s) => s.id) : []
    return records.map((record) => toChatItem(record, changes, slideIds))
  }

  // ---- attachments

  /** The paperclip: Open dialog, then copy the file into the lesson. */
  attach(lessonId: string): Promise<Result<{ attachment: AttachmentRef } | { cancelled: true }>> {
    return this.deps.lessons.files.pickAttachment(lessonId)
  }

  /** A file dropped on the chat. */
  attachPath(lessonId: string, path: string): Promise<Result<{ attachment: AttachmentRef }>> {
    return this.deps.lessons.files.attach(lessonId, path)
  }

  // ---- sending

  /** Validates the message, stores it and starts the turn as a job. */
  async send(args: ChatSendArgs): Promise<Result<StartedJob>> {
    let text = args.text.trim()
    if (!text && args.attachmentIds.length === 0)
      return fail('invalid-input', 'Type a message first.')
    if (args.attachmentIds.length > MAX_ATTACHMENTS)
      return fail('invalid-input', `You can attach up to ${MAX_ATTACHMENTS} files.`)
    if (args.regions.length > MAX_REGIONS)
      return fail('invalid-input', `You can circle up to ${MAX_REGIONS} areas in one message.`)
    const context = await this.deps.lessons.context(args.lessonId)
    if (!context.ok) return context
    // Her `{{name}}` tokens, pinned to ids: a rename since typing is harmless, a deleted asset is named in words.
    let assetRefs: ChatAssetRef[] = []
    const { assets } = this.deps
    if (assets) {
      const resolved = resolveMessageAssets(
        text,
        args.assetRefs,
        libraryOf(() => assets.list())
      )
      if (!resolved.ok) return resolved
      text = resolved.text
      assetRefs = resolved.refs
    }

    const started = this.deps.lessons.jobs.start(args.lessonId, 'chat', this.ids('msg'))
    if (!started.ok) return started
    const { job } = started

    const found = await Promise.all(
      args.attachmentIds.map((id) => this.deps.lessons.files.attachment(args.lessonId, id))
    )
    const attachments = found.filter((a): a is AttachmentRef => a !== undefined)
    const regions = describeRegions(args.regions, context.deck, text)
    try {
      await this.deps.store.append(
        args.lessonId,
        this.reporter.userRecord(text, attachments, regions, assetRefs)
      )
    } catch (error) {
      await this.deps.lessons.jobs.attach(job, async () => undefined)
      return fail('io', `The message could not be saved: ${String(error)}`)
    }
    this.deps.lessons.jobs.attach(job, () =>
      this.runTurn({
        args,
        text,
        attachments,
        deck: context.deck,
        style: context.style,
        job,
        assetRefs
      })
    )
    return ok({ jobId: job.id, messageId: job.messageId })
  }

  /** Stops a running chat job. The deck keeps any change that was already applied. */
  cancel(jobId: string): void {
    this.deps.lessons.jobs.cancel(jobId)
  }

  /** Resolves when the job's turn has finished (for tests and shutdown). */
  async whenDone(jobId: string): Promise<void> {
    await this.deps.lessons.jobs.get(jobId)?.done
  }

  // ---- ResultChip buttons

  /** Undo on a ResultChip: only while that change is the latest one. */
  undoChange(
    lessonId: string,
    changeSetId: string
  ): Promise<Result<{ deck: Deck; history: HistoryState; changeSet: ChangeSet }>> {
    return this.deps.lessons.undo(lessonId, changeSetId)
  }

  /** Redo on a ResultChip that reads "Undone": only while that change is the next redo. */
  redoChange(
    lessonId: string,
    changeSetId: string
  ): Promise<Result<{ deck: Deck; history: HistoryState; changeSet: ChangeSet }>> {
    return this.deps.lessons.redo(lessonId, changeSetId)
  }

  // ---- the turn

  private async runTurn(turn: Turn): Promise<void> {
    const { args, job, style } = turn
    const { lessonId } = args
    const messageId = job.messageId
    const emit = this.deps.emit
    let deck = turn.deck
    let reply = ''
    const changeSetIds: string[] = []
    const files: SavedFile[] = []
    const report: PluginReport = {
      change: (id) => changeSetIds.push(id),
      file: (file) => files.push(file)
    }

    // Claude's `{{name}}` tokens are checked against the library before they are shown or stored.
    const { assets, placer } = this.deps
    const gate = assets ? new AssistantTokenGate(libraryOf(() => assets.list())) : undefined
    const spotsBefore = countPictureSpots(deck.slides)
    const show = (text: string): void => {
      if (!text) return
      reply += text
      emit('chat:delta', { lessonId, messageId, text })
    }

    const end = (outcome: TurnOutcome): Promise<void> => {
      show(gate?.flush() ?? '')
      return this.reporter.end({
        lessonId,
        messageId,
        outcome,
        reply,
        changeSetIds,
        files,
        assets: gate?.refs,
        showSpots: countPictureSpots(deck.slides) > spotsBefore
      })
    }

    const sink: ChatSink = {
      delta: (text) => show(gate ? gate.push(text) : text),
      status: (step, state) => emit('chat:status', { lessonId, messageId, step, state }),
      // `chat:changes` is sent from `applyOps`, where the change is really committed.
      changes: () => undefined
    }

    const applyOps: ChatInput['applyOps'] = async (summary: string, ops: DeckOp[]) => {
      const edited = await this.deps.lessons.apply(lessonId, { by: 'ai', summary, ops })
      if (!edited.ok) return { ok: false, errors: [edited.message] }
      deck = edited.deck
      changeSetIds.push(edited.changeSet.id)
      emit('chat:changes', { lessonId, changeSet: edited.changeSet })
      return { ok: true, changeSetId: edited.changeSet.id }
    }

    try {
      const prepared = await this.prepare(turn)
      if (!prepared.ok) return await end(prepared)
      const selected = deck.slides.find((s) => s.id === args.selectedSlideId)
      const effort = effortFor(turn.text)
      const input: ChatInput = {
        lessonId,
        messageId,
        text: prepared.note ? `${turn.text}\n\n${prepared.note}` : turn.text,
        ...(prepared.regions.length ? { regions: prepared.regions } : {}),
        ...(turn.attachments.length
          ? { attachments: turn.attachments.map(({ name, kind }) => ({ name, kind })) }
          : {}),
        profile: style,
        deckOutline: deckOutline(deck),
        ...(selected ? { selectedSlideJson: selected } : {}),
        history: await this.deps.store.apiHistory(lessonId),
        ...(effort ? { effort } : {}),
        ...(this.deps.plugins ? { plugins: this.pluginsFor(turn, this.deps.plugins, report) } : {}),
        ...(assets && placer
          ? {
              assets: chatAssetsFor({
                assets,
                placer,
                style,
                lessonId,
                regions: args.regions,
                deck: () => deck,
                onPlaced: (placed) => {
                  deck = placed.deck
                  changeSetIds.push(placed.changeSet.id)
                  emit('chat:changes', { lessonId, changeSet: placed.changeSet })
                }
              })
            }
          : {}),
        applyOps,
        readSlides: (ids) => deck.slides.filter((s) => ids.includes(s.id)),
        viewSlide: (slideId) => this.view(deck, turn, slideId)
      }
      const outcome = await this.deps.ai.chatTurn(input, sink, { signal: job.signal })
      await end(outcome)
    } catch (error) {
      const failure = fail('unknown', error instanceof Error ? error.message : String(error))
      await end(failure)
    }
  }

  /** Renders the circled regions (when there are any) and words the Draw tool's marks. */
  private async prepare(
    turn: Turn
  ): Promise<Result<{ regions: NonNullable<ChatTurnInput['regions']>; note: string }>> {
    const { args, deck } = turn
    const wantsImages = args.regions.length > 0 || args.markup.some((m) => m.strokes.length > 0)
    if (!wantsImages) return ok({ regions: [], note: '' })
    const { renderer } = this.deps
    if (!renderer)
      return fail('unknown', 'I can’t look at the slides right now. Try again in a moment.')
    try {
      const rendered = await renderRegions({
        regions: args.regions,
        markup: args.markup,
        deck,
        style: turn.style,
        renderer,
        readAsset: this.deps.lessons.files.assetReader(args.lessonId)
      })
      const note = rendered.markedSlides.length
        ? `The teacher also drew marks on slide ${rendered.markedSlides.join(', ')}.`
        : ''
      return ok({ regions: rendered.payloads, note })
    } catch {
      return fail('unknown', 'I couldn’t look at the circled area. Try again.')
    }
  }

  private pluginsFor(turn: Turn, bridge: ChatPluginBridge, report: PluginReport): ChatPlugins {
    return {
      list: () => bridge.list(),
      run: (pluginId, inputs) =>
        bridge.run({
          lessonId: turn.args.lessonId,
          pluginId,
          inputs,
          currentSlideId: turn.args.selectedSlideId,
          signal: turn.job.signal,
          messageId: turn.job.messageId,
          report
        })
    }
  }

  private async view(deck: Deck, turn: Turn, slideId: string): Promise<Uint8Array> {
    const slide = deck.slides.find((s) => s.id === slideId)
    if (!slide) throw new Error(`There is no slide "${slideId}".`)
    if (!this.deps.renderer) throw new Error('Slides cannot be drawn right now.')
    return this.deps.renderer.renderSlidePng({
      slide,
      style: turn.style,
      width: FULL_WIDTH,
      height: FULL_HEIGHT,
      readAsset: this.deps.lessons.files.assetReader(turn.args.lessonId)
    })
  }
}
