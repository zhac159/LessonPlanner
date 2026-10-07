import { cx } from '../cx'
import './ProgressDots.css'

export interface ProgressDotsProps {
  /** `md` = 8px dots (chat), `sm` = 7px dots (inside pills). */
  size?: 'md' | 'sm'
  className?: string
}

/** Three orange dots that pulse in turn: "I'm working on it". Decorative, so always aria-hidden. */
export function ProgressDots({ size = 'md', className }: ProgressDotsProps) {
  return (
    <span className={cx('ui-dots', className)} data-size={size} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}
