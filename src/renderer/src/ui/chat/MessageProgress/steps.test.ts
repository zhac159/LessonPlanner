import { describe, expect, it } from 'vitest'
import { visibleSteps, type ProgressStepItem, type StepState } from './steps'

const make = (states: StepState[]): ProgressStepItem[] =>
  states.map((state, i) => ({ label: `s${i}`, state }))
const labels = (steps: ProgressStepItem[]): string[] => steps.map((s) => s.label)

describe('visibleSteps', () => {
  it('returns every step when there are few', () => {
    const steps = make(['done', 'running', 'upcoming'])
    expect(visibleSteps(steps)).toEqual(steps)
  })

  it('returns a copy, not the input array', () => {
    const steps = make(['done'])
    expect(visibleSteps(steps)).not.toBe(steps)
  })

  it('starts at the top while the first steps are running', () => {
    const steps = make(['running', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(labels(visibleSteps(steps))).toEqual(['s0', 's1', 's2', 's3'])
  })

  it('keeps the running step with finished ones above and one upcoming below', () => {
    const steps = make(['done', 'done', 'done', 'done', 'done', 'running', 'upcoming', 'upcoming'])
    expect(labels(visibleSteps(steps))).toEqual(['s3', 's4', 's5', 's6'])
  })

  it('shows the last steps when the final one is running', () => {
    const steps = make(['done', 'done', 'done', 'done', 'done', 'done', 'done', 'running'])
    expect(labels(visibleSteps(steps))).toEqual(['s4', 's5', 's6', 's7'])
  })

  it('keeps a failed step visible', () => {
    const steps = make(['done', 'done', 'done', 'done', 'error', 'upcoming', 'upcoming'])
    expect(labels(visibleSteps(steps))).toContain('s4')
  })

  it('follows the last finished step when nothing is running', () => {
    const steps = make(['done', 'done', 'done', 'done', 'done', 'upcoming', 'upcoming'])
    expect(labels(visibleSteps(steps))).toContain('s4')
    const allDone = make(['done', 'done', 'done', 'done', 'done'])
    expect(labels(visibleSteps(allDone))).toEqual(['s1', 's2', 's3', 's4'])
  })

  it('honours a custom maximum', () => {
    const steps = make(['done', 'done', 'running', 'upcoming', 'upcoming'])
    expect(visibleSteps(steps, 3)).toHaveLength(3)
  })
})
