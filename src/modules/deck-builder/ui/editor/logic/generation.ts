/**
 * What the filmstrip shows while slides are being generated (05 §7). Pure.
 *
 * Generated slides arrive as `slide-ready` events and only reach `deck.json` when the job ends, so the editor holds
 * them here and merges them after the slides already in the deck.
 */
import type { GenProgress } from '@shared/contracts/deck-builder'
import type { Slide } from '@shared/deck/types'

export interface GenerationView {
  /** A generation job is running. */
  running: boolean
  /** The last progress event. */
  progress: GenProgress | null
  /** Slides finished so far, by their position in the plan. */
  live: Array<{ index: number; slide: Slide }>
}

export const IDLE_GENERATION: GenerationView = { running: false, progress: null, live: [] }

/** A progress event: stages before `done` and `error` mean the job is running. */
export function withProgress(view: GenerationView, event: GenProgress): GenerationView {
  const running = event.stage !== 'done' && event.stage !== 'error'
  // A new run starts from nothing; the end keeps the live slides until the deck has been re-read.
  const fresh = running && event.stage === 'reading'
  return { running, progress: event, live: fresh ? [] : view.live }
}

/** A finished slide: replaces an earlier version at the same position. */
export function withSlide(
  view: GenerationView,
  event: { slide: Slide; index: number }
): GenerationView {
  const live = [...view.live.filter((entry) => entry.index !== event.index), event].sort(
    (a, b) => a.index - b.index
  )
  return { ...view, live }
}

/** The deck's slides followed by the generated ones it does not contain yet. */
export function slidesWithLive(deckSlides: readonly Slide[], view: GenerationView): Slide[] {
  const known = new Set(deckSlides.map((slide) => slide.id))
  return [...deckSlides, ...view.live.map((entry) => entry.slide).filter((s) => !known.has(s.id))]
}

/** Skeletons still to fill while the job runs; none once it has stopped. */
export function pendingSlides(view: GenerationView): number {
  if (!view.running || !view.progress) return 0
  return Math.max(0, view.progress.total - Math.max(view.progress.done, view.live.length))
}

/** "5 of 8 slides made": set when a job ended early and part of the plan is missing. */
export function unfinishedSummary(view: GenerationView): { done: number; total: number } | null {
  const { progress } = view
  if (view.running || !progress || progress.stage !== 'error') return null
  if (progress.total <= 0 || progress.done >= progress.total) return null
  return { done: progress.done, total: progress.total }
}
