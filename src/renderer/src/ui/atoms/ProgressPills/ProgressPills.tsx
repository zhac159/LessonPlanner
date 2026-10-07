import { Check } from 'lucide-react'
import { cx } from '../cx'
import './ProgressPills.css'

export interface ProgressStep {
  id: string
  label: string
}

export interface ProgressPillsProps {
  steps: ReadonlyArray<ProgressStep>
  /** Zero-based index of the current step. */
  current: number
  /** When given, done pills become buttons that go back to that step. */
  onStepClick?: (index: number) => void
  className?: string
}

/** Onboarding progress: done pills (mint, check), the current pill (orange), upcoming (muted). */
export function ProgressPills({ steps, current, onStepClick, className }: ProgressPillsProps) {
  return (
    <ol
      className={cx('ui-pills', className)}
      aria-label={`Setup progress: step ${current + 1} of ${steps.length}`}
    >
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming'
        const content = (
          <>
            {state === 'done' && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            {step.label}
          </>
        )
        return (
          <li key={step.id} className="ui-pills__item">
            {index > 0 && <span className="ui-pills__link" data-state={state} aria-hidden="true" />}
            {state === 'done' && onStepClick ? (
              <button
                type="button"
                className="ui-pills__pill"
                data-state={state}
                onClick={() => onStepClick(index)}
              >
                {content}
              </button>
            ) : (
              <span
                className="ui-pills__pill"
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {content}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
