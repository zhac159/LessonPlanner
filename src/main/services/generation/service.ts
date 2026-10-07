/**
 * `GenerationService`: "Make my slides" (design/screens/05-new-lesson.md, ai-pipeline.md §4.4-§4.6).
 *
 *   read the objectives -> plan the lesson -> write the slides (first alone, then 3 at a time) -> commit
 *
 * The whole generation is ONE ChangeSet group, committed at the end: slides reach the UI as `slide-ready` events
 * while they are written, the deck on disk changes once. Stop and failures keep the slides that are finished
 * ("5 of 8 slides made — Finish the rest?"); the plan is kept in `generation.json` so `finish` can carry on.
 */
import { isRetryable } from '@shared/ai/errors'
import { EMPTY_USAGE } from '@shared/ai/prices'
import type { AiService, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { GenProgress } from '@shared/contracts/deck-builder'
import type { AttachmentRef, StartedJob } from '@shared/contracts/deck-builder-chat'
import type { LessonMeta, Slide } from '@shared/deck/types'
import { newId } from '@shared/ids'
import { fail, ok, type Failure, type Result } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { toAiErrorCode } from '../chat/errors'
import type { ChatRecord } from '../chat/records'
import type { ChatLog } from '../chat/store'
import type { LessonAssetsPort } from '../lessons/assetsPort'
import type { Job } from '../lessons/jobs'
import type { LessonsService } from '../lessons/service'
import type { EmitEvent, GenerationRecord } from '../lessons/types'
import { GenerationAssets } from './assets'
import { commitMade, presentSlideIds } from './commit'
import { DocumentReader } from './documents'
import { describeStop } from './ending'
import { makeBrief, makePlan } from './planner'
import { finishText } from './summary'
import { CONCURRENCY, writeSlides } from './writer'

export interface GenerationServiceDeps {
  lessons: LessonsService
  ai: AiService
  chatLog: ChatLog
  /** The teacher's library: the writer places her assets by name and leaves picture spots (agents/ASSETS.md §5.4). */
  assets?: LessonAssetsPort
  emit: EmitEvent
  clock?: () => Date
  ids?: (prefix: string) => string
  /** Slides written at once (spec: 3). */
  concurrency?: number
}

/** What the teacher gave "Make my slides". */
export interface GenerateArgs {
  lessonId: string
  /** The Composer text. */
  text: string
  /** Attached LO documents (inbox ids, or already in the lesson). */
  documentIds: string[]
  meta: Partial<LessonMeta>
}

interface Run {
  job: Job
  lessonId: string
  /** Set when carrying on from an earlier stopped run. */
  resume?: GenerationRecord
  text: string
  documentIds: string[]
  meta: Partial<LessonMeta>
}

/** What the planning stages produced. */
interface Planned {
  brief: LessonBrief
  plan: LessonPlan
  slideIds: Array<string | null>
}

export const NOTHING_TO_FINISH = 'There is nothing left to finish.'

export class GenerationService {
  /** Reads attached documents (also used on its own, right after a document is attached). */
  readonly documents: DocumentReader
  private readonly clock: () => Date
  private readonly ids: (prefix: string) => string
  /** Per job: finished, and the lesson list told about it (the job registry forgets a job when it is done). */
  private readonly closing = new Map<string, Promise<void>>()

  constructor(private readonly deps: GenerationServiceDeps) {
    this.clock = deps.clock ?? (() => new Date())
    this.ids = deps.ids ?? newId
    this.documents = new DocumentReader({
      lessons: deps.lessons,
      ai: deps.ai,
      emit: deps.emit
    })
  }

  // ---- starting and stopping

  /** Generates slides into an existing lesson. */
  async generate(args: GenerateArgs): Promise<Result<StartedJob>> {
    if (!args.text.trim() && args.documentIds.length === 0)
      return fail('invalid-input', 'Add your learning objectives, or attach a document, first.')
    return this.start(args.lessonId, {
      text: args.text,
      documentIds: args.documentIds,
      meta: args.meta
    })
  }

  /** "Finish the rest" after a stopped or failed generation. */
  async finish(lessonId: string): Promise<Result<StartedJob>> {
    const resume = await this.deps.lessons.getGenerationRecord(lessonId)
    if (!resume) return fail('not-found', NOTHING_TO_FINISH)
    return this.start(lessonId, { text: '', documentIds: [], meta: {}, resume })
  }

  /** Stops a running generation. Finished slides are kept. */
  cancel(jobId: string): void {
    this.deps.lessons.jobs.cancel(jobId)
  }

  /** Resolves when the job has finished and the lesson list has heard about it (for tests and shutdown). */
  async whenDone(jobId: string): Promise<void> {
    await this.deps.lessons.jobs.get(jobId)?.done
    await this.closing.get(jobId)
  }

  private async start(
    lessonId: string,
    rest: Pick<Run, 'text' | 'documentIds' | 'meta' | 'resume'>
  ): Promise<Result<StartedJob>> {
    const { lessons } = this.deps
    const context = await lessons.context(lessonId)
    if (!context.ok) return context
    const started = lessons.jobs.start(lessonId, 'generation', this.ids('msg'))
    if (!started.ok) return started
    const { job } = started
    if (!rest.resume) await lessons.setGenerationRecord(lessonId, null)
    const finished = lessons.jobs
      .attach(job, () => this.execute({ job, lessonId, ...rest }))
      .then(() => lessons.notifyChanged())
    const closing = finished.then(
      () => undefined,
      () => undefined
    )
    this.closing.set(job.id, closing)
    void closing.then(() => this.closing.delete(job.id))
    void lessons.notifyChanged()
    return ok({ jobId: job.id, messageId: job.messageId })
  }

  // ---- the run

  private progress(
    run: Run,
    stage: GenProgress['stage'],
    done: number,
    total: number,
    extra: Partial<GenProgress> = {}
  ): void {
    this.deps.emit('gen-progress', { lessonId: run.lessonId, stage, done, total, ...extra })
  }

  /** Runs the job; anything unexpected becomes a friendly error instead of a stuck lesson. */
  private async execute(run: Run): Promise<void> {
    try {
      await this.produce(run)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.stop(run, fail('unknown', message), 0, 0, undefined)
    }
  }

  private async produce(run: Run): Promise<void> {
    const { lessons } = this.deps
    const opened = await lessons.open(run.lessonId)
    if (!opened.ok) return this.stop(run, opened, 0, 0, undefined)
    const style = (await lessons.styleById(opened.deck.styleId)) ?? null
    const attachments = run.resume ? [] : await this.attachments(run)
    if (!run.resume) await this.say(run.lessonId, this.userRecord(run.text, attachments))

    let planned: Planned
    if (run.resume) {
      planned = { brief: run.resume.brief, plan: run.resume.plan, slideIds: run.resume.slideIds }
    } else {
      const made = await this.planning(
        run,
        style,
        opened.titleSource === 'user' ? opened.deck.title : undefined,
        opened.titleSource
      )
      if (!made.ok) return this.stop(run, made, 0, 0, undefined)
      planned = made.planned
    }
    await this.writing(run, planned, style)
  }

  /** Reading the objectives, then planning: until a validated plan exists. */
  private async planning(
    run: Run,
    style: StyleProfile | null,
    typedTitle: string | undefined,
    titleSource: 'auto' | 'user'
  ): Promise<{ ok: true; planned: Planned } | Failure> {
    const { ai } = this.deps
    this.progress(run, 'reading', 0, 0, { message: 'Reading your objectives…' })
    const brief = await makeBrief(
      { ai, documents: this.documents },
      {
        lessonId: run.lessonId,
        text: run.text,
        documentIds: run.documentIds,
        meta: run.meta,
        typedTitle
      },
      run.job.signal
    )
    if (!brief.ok) return brief
    this.progress(run, 'planning', 0, 0, { message: 'Planning your lesson…' })
    const plan = await makePlan(ai, style, brief.brief, run.job.signal, (message) =>
      this.progress(run, 'planning', 0, 0, { message })
    )
    if (!plan.ok) return plan
    const planned: Planned = {
      brief: brief.brief,
      plan: plan.plan,
      slideIds: plan.plan.slides.map(() => null)
    }
    await this.deps.lessons.setGenerationRecord(run.lessonId, this.record(planned, 'error'))
    this.progress(run, 'writing', 0, planned.plan.slides.length, {
      ...(titleSource === 'auto' && plan.plan.title ? { title: plan.plan.title } : {})
    })
    return { ok: true, planned }
  }

  /** Writing the slides, committing the finished ones as one ChangeSet group, and saying how it went. */
  private async writing(run: Run, planned: Planned, style: StyleProfile | null): Promise<void> {
    const { lessons } = this.deps
    const { plan, brief } = planned
    const total = plan.slides.length
    const before = await lessons.open(run.lessonId)
    if (!before.ok) return this.stop(run, before, 0, total, planned)
    const deckIds = before.deck.slides.map((s) => s.id)
    const present = presentSlideIds(deckIds, planned.slideIds)
    const todo = plan.slides.map((_, i) => i).filter((i) => present[i] === null)
    let done = total - todo.length
    this.progress(run, 'writing', done, total)

    const pictures = this.deps.assets
      ? new GenerationAssets({ assets: this.deps.assets, lessons, style })
      : undefined
    const outcome = await writeSlides({
      ai: this.deps.ai,
      profile: style,
      brief,
      plan,
      todo,
      takenIds: new Set(deckIds),
      signal: run.job.signal,
      newId: this.ids,
      ...(pictures?.catalogue ? { assets: pictures.catalogue } : {}),
      ...(pictures ? { adopt: (slide: Slide) => pictures.adopt(run.lessonId, slide) } : {}),
      concurrency: this.deps.concurrency ?? CONCURRENCY,
      onSlide: (index: number, slide: Slide) => {
        done += 1
        this.deps.emit('slide-ready', { lessonId: run.lessonId, slide, index })
        this.progress(run, 'writing', done, total)
      }
    })

    const changeSetIds: string[] = []
    if (outcome.made.size > 0) {
      const committed = await commitMade(lessons, {
        lessonId: run.lessonId,
        brief,
        plan,
        slideIds: planned.slideIds,
        made: outcome.made,
        newId: this.ids,
        now: this.clock().toISOString()
      })
      if (!committed.ok) return this.stop(run, committed, 0, total, planned)
      changeSetIds.push(committed.changeSet.id)
      this.deps.emit('chat:changes', { lessonId: run.lessonId, changeSet: committed.changeSet })
    }

    const kept: Planned = {
      ...planned,
      slideIds: planned.slideIds.map((_, i) => outcome.made.get(i)?.id ?? present[i])
    }
    if (outcome.failure) {
      const stoppedBy = outcome.failure.code === 'cancelled' ? 'cancelled' : 'error'
      await lessons.setGenerationRecord(run.lessonId, this.record(kept, stoppedBy))
      return this.stop(run, outcome.failure, done, total, kept, changeSetIds)
    }
    await lessons.setGenerationRecord(run.lessonId, null)
    const told = await this.summary(run, plan.summary, [...outcome.made.values()])
    await this.say(run.lessonId, {
      ...this.assistant(run.job.messageId, told.text),
      ui: {
        text: told.text,
        ...(changeSetIds.length ? { changeSetIds } : {}),
        ...(told.assets.length ? { assets: told.assets } : {}),
        ...(told.showSpots ? { showSpots: true } : {})
      }
    })
    const { lessonId } = run
    const messageId = run.job.messageId
    this.deps.emit('chat:delta', { lessonId, messageId, text: told.text })
    this.progress(run, 'done', total, total)
    this.deps.emit('chat:done', { lessonId, messageId, usage: { ...EMPTY_USAGE } })
  }

  /** Her summary plus the pictures used and the spot sentence (see `finishText`). */
  private async summary(run: Run, summary: string, made: readonly Slide[]) {
    const library = this.deps.assets
    if (!library || made.length === 0) return { text: summary, assets: [], showSpots: false }
    const opened = await this.deps.lessons.open(run.lessonId)
    return finishText(summary, made, opened.ok ? opened.deck.slides : [], library)
  }

  // ---- ending badly

  /** Tells the UI and the chat how a generation ended early. Finished slides were already committed. */
  private async stop(
    run: Run,
    failure: Failure,
    done: number,
    total: number,
    planned: Planned | undefined,
    changeSetIds: string[] = []
  ): Promise<void> {
    const { lessonId } = run
    const messageId = run.job.messageId
    const cancelled = failure.code === 'cancelled'
    const { message, error } = describeStop(failure, done, total, planned !== undefined)
    await this.say(lessonId, {
      ...this.assistant(messageId, ''),
      ui: { text: '', ...(changeSetIds.length ? { changeSetIds } : {}), error }
    })
    this.progress(run, 'error', done, total, { message })
    if (cancelled) {
      this.deps.emit('chat:done', { lessonId, messageId, usage: { ...EMPTY_USAGE } })
      return
    }
    this.deps.emit('ai:error', {
      scope: 'generation',
      code: toAiErrorCode(failure.code),
      message,
      retryable: isRetryable(failure.code) || failure.code === 'invalid-input'
    })
  }

  // ---- records

  private record(planned: Planned, stoppedBy: GenerationRecord['stoppedBy']): GenerationRecord {
    return { state: 'partial', ...planned, stoppedBy }
  }

  private async attachments(run: Run): Promise<AttachmentRef[]> {
    const { lessons } = this.deps
    await lessons.files.adoptDocuments(run.lessonId, run.documentIds)
    const found = await Promise.all(
      run.documentIds.map((id) => lessons.files.attachment(run.lessonId, id))
    )
    return found.filter((a): a is AttachmentRef => a !== undefined)
  }

  private userRecord(text: string, attachments: AttachmentRef[]): ChatRecord {
    return {
      id: this.ids('msg'),
      role: 'user',
      at: this.clock().toISOString(),
      ui: { text, ...(attachments.length ? { attachments } : {}) },
      api: []
    }
  }

  private assistant(id: string, text: string): ChatRecord {
    return { id, role: 'assistant', at: this.clock().toISOString(), ui: { text }, api: [] }
  }

  private async say(lessonId: string, record: ChatRecord): Promise<void> {
    try {
      await this.deps.chatLog.append(lessonId, record)
    } catch {
      // History is a convenience: a full disk must not turn a finished generation into an error.
    }
  }
}
