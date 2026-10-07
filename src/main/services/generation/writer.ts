/**
 * The writing stage of a generation: one `writeSlide` per planned slide, the first alone and then three at a
 * time. Each finished slide is checked (valid deck-model slide, unique id) and handed to `onSlide` at once so the
 * filmstrip can fill up live. Nothing is written to the deck here; the service commits everything at the end.
 */
import type { AiService, AssetCatalogue, LessonBrief, LessonPlan } from '@shared/ai/types'
import { slideSchema } from '@shared/deck/schema'
import type { Slide } from '@shared/deck/types'
import { fail, type Failure } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { runPool } from './pool'

export const CONCURRENCY = 3
export const UNUSABLE_SLIDE = 'Claude wrote a slide I couldn’t use.'

export interface WriteJob {
  ai: AiService
  profile: StyleProfile | null
  brief: LessonBrief
  plan: LessonPlan
  /** Plan indexes still to write, in order. */
  todo: readonly number[]
  /** Slide ids already in use (the deck's, and earlier slides of this run). */
  takenIds: Set<string>
  signal: AbortSignal
  newId: (prefix: string) => string
  /** The teacher's assets for the writer's prompt (undefined: none, the slides just get picture spots). */
  assets?: AssetCatalogue
  /** Finishes a valid slide before anyone sees it: copy-on-use, her placement rules, credits (see assets.ts). */
  adopt?: (slide: Slide) => Promise<Slide>
  concurrency?: number
  /** A slide is ready (`index` is its place in the plan). */
  onSlide(index: number, slide: Slide): void
}

export interface WriteOutcome {
  /** Finished slides by plan index. */
  made: Map<number, Slide>
  /** Why writing stopped early (`cancelled` when the teacher pressed Stop); undefined when all were written. */
  failure?: Failure
}

/** Gives the slide an id nobody has, the plan's layout and the AI mark; undefined when it is not a valid slide. */
function accepted(slide: Slide, layoutId: string, job: WriteJob): Slide | undefined {
  const free = slide.id && !job.takenIds.has(slide.id) ? slide.id : job.newId('sld')
  const candidate: Slide = {
    ...slide,
    id: free,
    ...(slide.layoutId || !layoutId ? {} : { layoutId }),
    source: { by: 'ai' }
  }
  return slideSchema.safeParse(candidate).success ? candidate : undefined
}

/** The slide after `job.adopt`; the writer's own slide when adopting fails or gives something invalid. */
async function adopted(slide: Slide, job: WriteJob): Promise<Slide> {
  if (!job.adopt) return slide
  try {
    const next = await job.adopt(slide)
    return slideSchema.safeParse(next).success ? next : slide
  } catch {
    return slide
  }
}

async function writeOne(job: WriteJob, index: number): Promise<{ slide: Slide } | Failure> {
  const layoutId = job.plan.slides[index]?.layoutId ?? ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const written = await job.ai.writeSlide(
      {
        profile: job.profile,
        brief: job.brief,
        plan: job.plan,
        index,
        ...(job.assets ? { assets: job.assets } : {})
      },
      { signal: job.signal }
    )
    if (!written.ok) return written
    const slide = accepted(written.slide, layoutId, job)
    if (slide) return { slide: await adopted(slide, job) }
  }
  return fail('unknown', UNUSABLE_SLIDE)
}

/** Writes the slides in `job.todo`. Stops starting new ones after the first failure or a Stop. */
export async function writeSlides(job: WriteJob): Promise<WriteOutcome> {
  const made = new Map<number, Slide>()
  let failure: Failure | undefined
  await runPool(job.todo, job.concurrency ?? CONCURRENCY, async (index) => {
    if (job.signal.aborted) {
      failure ??= fail('cancelled', 'Stopped.')
      return 'stop'
    }
    const outcome = await writeOne(job, index)
    if (!('slide' in outcome)) {
      failure ??= outcome
      return 'stop'
    }
    job.takenIds.add(outcome.slide.id)
    made.set(index, outcome.slide)
    job.onSlide(index, outcome.slide)
    return 'continue'
  })
  return { made, ...(failure ? { failure } : {}) }
}
