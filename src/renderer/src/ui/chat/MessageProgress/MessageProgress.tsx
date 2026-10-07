import { Check, CircleAlert } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { Button } from '../../atoms/Button/Button'
import { ProgressBar } from '../../atoms/ProgressBar/ProgressBar'
import { ProgressDots } from '../../atoms/ProgressDots/ProgressDots'
import { visibleSteps, type ProgressStepItem, type StepState } from './steps'
import './MessageProgress.css'

export interface MessageProgressProps {
  /** What is happening, as a present participle: "Drawing your leaf diagram…". */
  label: string
  /** Named steps (plugins, slide generation): finished ones get a tick, the current one dots. */
  steps?: ProgressStepItem[]
  /** Known progress: shows a bar instead of only dots. Leave out for "indeterminate". */
  progress?: { value: number; max: number; label: string }
  /** Adds a Stop button. */
  onStop?: () => void
  /** Wording of the Stop button. */
  stopLabel?: string
  className?: string
}

const STATE_TEXT: Record<StepState, string> = {
  done: 'done',
  running: 'in progress',
  upcoming: 'waiting',
  error: 'failed'
}

function StepMark({ state }: { state: StepState }) {
  if (state === 'done') return <Check size={14} strokeWidth={3} aria-hidden="true" />
  if (state === 'error') return <CircleAlert size={14} strokeWidth={2.4} aria-hidden="true" />
  if (state === 'running') return <ProgressDots size="sm" />
  return null
}

/** The dashed "I'm working on it" box shown until the first text of a reply streams in. */
export function MessageProgress({
  label,
  steps,
  progress,
  onStop,
  stopLabel = 'Stop',
  className
}: MessageProgressProps) {
  const shown = steps ? visibleSteps(steps) : []
  return (
    <div className={cx('ui-msg-p', className)} role="status">
      <div className="ui-msg-p__row">
        {!progress && <ProgressDots />}
        <span className="ui-msg-p__label">{label}</span>
        {onStop && (
          <Button variant="ghost" size="sm" onClick={onStop}>
            {stopLabel}
          </Button>
        )}
      </div>
      {progress && <ProgressBar {...progress} />}
      {shown.length > 0 && (
        <ul className="ui-msg-p__steps">
          {shown.map((step, i) => (
            <li key={`${i}-${step.label}`} className="ui-msg-p__step" data-state={step.state}>
              <span className="ui-msg-p__mark">
                <StepMark state={step.state} />
              </span>
              <span>{step.label}</span>
              <span className="sr-only"> ({STATE_TEXT[step.state]})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
