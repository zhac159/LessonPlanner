export type StepState = 'done' | 'running' | 'upcoming' | 'error'

export interface ProgressStepItem {
  label: string
  state: StepState
}

/** How many steps the progress box shows at once. */
export const MAX_VISIBLE_STEPS = 4

/**
 * The steps to show: all of them up to `max`, otherwise a window that keeps the current
 * (running or failed) step visible with finished ones above it and upcoming ones below.
 */
export function visibleSteps(
  steps: ReadonlyArray<ProgressStepItem>,
  max: number = MAX_VISIBLE_STEPS
): ProgressStepItem[] {
  if (steps.length <= max) return [...steps]
  let current = steps.findIndex((s) => s.state === 'running' || s.state === 'error')
  if (current < 0) {
    const firstUpcoming = steps.findIndex((s) => s.state === 'upcoming')
    current = firstUpcoming < 0 ? steps.length - 1 : Math.max(firstUpcoming - 1, 0)
  }
  const start = Math.min(Math.max(current - (max - 2), 0), steps.length - max)
  return steps.slice(start, start + max)
}
