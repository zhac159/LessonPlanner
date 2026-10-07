import { cx } from '../cx'
import './ProgressBar.css'

export interface ProgressBarProps {
  /** How many are done. Clamped to 0..max. */
  value: number
  /** The total. A total of 0 shows an empty bar. */
  max: number
  /** Label above the bar, e.g. "6 of 8 learned". */
  label: string
  /** Right-hand estimate, e.g. "About a minute left". */
  estimate?: string
  /** Screen-reader wording, e.g. "6 of 8 files learned". Defaults to the label. */
  valueText?: string
  className?: string
}

/** Determinate progress: a labelled orange fill in a pill track. */
export function ProgressBar({
  value,
  max,
  label,
  estimate,
  valueText,
  className
}: ProgressBarProps) {
  const now = Math.min(Math.max(value, 0), Math.max(max, 0))
  const percent = max > 0 ? (now / max) * 100 : 0
  return (
    <div className={cx('ui-progress', className)}>
      <div className="ui-progress__row">
        <span className="ui-progress__label">{label}</span>
        {estimate && <span className="ui-progress__estimate">{estimate}</span>}
      </div>
      <div
        className="ui-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={now}
        aria-valuetext={valueText ?? label}
      >
        <span
          className="ui-progress__fill"
          data-edge={percent > 0 && percent < 100 ? 'rule' : 'none'}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
