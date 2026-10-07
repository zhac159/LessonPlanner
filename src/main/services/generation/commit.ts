/**
 * Turns a generation's finished slides into ChangeSets (one `setMeta`, then one `insertSlides` per slide) that the
 * lessons service commits as ONE undo step (ai-pipeline.md §4.5). Pure.
 */
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import type { ChangeSet, Deck, DeckOp, LessonMeta, Slide } from '@shared/deck/types'
import { ok, type Result } from '@shared/result'
import type { LessonsService } from '../lessons/service'

export interface CommitInput {
  deck: Pick<Deck, 'slides' | 'title' | 'meta'>
  titleSource: 'auto' | 'user'
  brief: LessonBrief
  plan: LessonPlan
  /** Slide id per plan index from earlier runs (null = not written). Entries missing from the deck count as not written. */
  slideIds: ReadonlyArray<string | null>
  /** Slides written in this run, by plan index. */
  made: ReadonlyMap<number, Slide>
  newId: (prefix: string) => string
  now: string
}

/** The lesson facts a generation sets (the objectives, subject, year…); nothing the teacher left empty. */
export function metaFrom(brief: LessonBrief): Partial<LessonMeta> {
  const meta: Partial<LessonMeta> = { objectives: brief.objectives }
  if (brief.subject) meta.subject = brief.subject
  if (brief.yearGroup) meta.yearGroup = brief.yearGroup
  if (brief.durationMin) meta.durationMin = brief.durationMin
  if (brief.ability) meta.ability = brief.ability
  if (brief.targetSlideCount) meta.targetSlideCount = brief.targetSlideCount
  if (brief.context) meta.context = brief.context
  return meta
}

/** The slide id each plan index has in the deck now (written earlier and still there), else null. */
export function presentSlideIds(
  deckSlideIds: readonly string[],
  slideIds: ReadonlyArray<string | null>
): Array<string | null> {
  const present = new Set(deckSlideIds)
  return slideIds.map((id) => (id !== null && present.has(id) ? id : null))
}

/**
 * Where the first new slide goes: before the first slide of an earlier run that is still in the deck, else at the
 * end of the deck.
 */
function startingPoint(
  deckIds: readonly string[],
  present: ReadonlyArray<string | null>
): string | null {
  const firstPlanned = present.find((id) => id !== null)
  if (firstPlanned) {
    const at = deckIds.indexOf(firstPlanned)
    return at <= 0 ? null : deckIds[at - 1]
  }
  return deckIds.at(-1) ?? null
}

function metaOp(input: CommitInput): DeckOp | undefined {
  const meta = metaFrom(input.brief)
  const title =
    input.titleSource === 'auto' && input.plan.title.trim() && input.plan.title !== input.deck.title
      ? input.plan.title.trim()
      : undefined
  const changed = (Object.keys(meta) as Array<keyof LessonMeta>).some(
    (key) => JSON.stringify(meta[key]) !== JSON.stringify(input.deck.meta[key])
  )
  return title || changed
    ? { op: 'setMeta', ...(title ? { title } : {}), ...(changed ? { meta } : {}) }
    : undefined
}

/**
 * The ChangeSets of a generation, in order. Each new slide is inserted after the previous slide of the plan, so
 * the deck ends up in plan order; later slides of an earlier run stay where they are.
 */
export function generationChangeSets(input: CommitInput): ChangeSet[] {
  const deckIds = input.deck.slides.map((s) => s.id)
  const present = presentSlideIds(deckIds, input.slideIds)
  const sets: ChangeSet[] = []
  const add = (ops: DeckOp[], summary: string): void => {
    sets.push({ id: input.newId('chg'), by: 'ai', summary, ops, at: input.now })
  }
  const meta = metaOp(input)
  if (meta) add([meta], 'Set up the lesson')
  let cursor = startingPoint(deckIds, present)
  for (let index = 0; index < input.plan.slides.length; index++) {
    const slide = input.made.get(index)
    if (slide) {
      add(
        [{ op: 'insertSlides', afterSlideId: cursor, slides: [slide] }],
        `Added slide ${index + 1}`
      )
      cursor = slide.id
    } else if (present[index]) {
      cursor = present[index]
    }
  }
  return sets
}

/** Commits the slides written in this run as ONE undo step; fails when the lesson cannot be read or a ChangeSet is invalid. */
export async function commitMade(
  lessons: LessonsService,
  input: Omit<CommitInput, 'deck' | 'titleSource'> & { lessonId: string }
): Promise<Result<{ changeSet: ChangeSet }>> {
  const current = await lessons.open(input.lessonId)
  if (!current.ok) return current
  const sets = generationChangeSets({
    ...input,
    deck: current.deck,
    titleSource: current.titleSource
  })
  const committed = await lessons.applyGroup(input.lessonId, sets, {
    summary: `Made ${input.made.size} ${input.made.size === 1 ? 'slide' : 'slides'}`
  })
  return committed.ok ? ok({ changeSet: committed.changeSet }) : committed
}
