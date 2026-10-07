import { Check, CircleAlert } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../cx'
import { ProgressDots } from '../ProgressDots/ProgressDots'
import './StatusPill.css'

export type StatusTone = 'done' | 'working' | 'waiting' | 'error' | 'neutral' | 'inverse' | 'tag'

export interface StatusPillProps {
  children: ReactNode
  /** done = mint, working = butter (with dots), waiting = purple, error = peach (with alert), tag = `color`. */
  tone?: StatusTone
  /** xs = year chip, sm = file status, md = tag, lg = header status (40px). */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Fill for `tone="tag"`, e.g. `var(--year-8)`. */
  color?: string
  /** Show a check mark before the label (the "Connected" pill). */
  check?: boolean
  /** Announce changes to screen readers (`role="status"`). Use only for values that change live. */
  live?: boolean
  className?: string
}

/** A small word-in-a-pill status. Always a word, never just a colour. */
export function StatusPill({
  children,
  tone = 'neutral',
  size = 'sm',
  color,
  check = false,
  live = false,
  className
}: StatusPillProps) {
  const style = color ? ({ '--pill-bg': color } as CSSProperties) : undefined
  return (
    <span
      className={cx('ui-pill', className)}
      data-tone={tone}
      data-size={size}
      role={live ? 'status' : undefined}
      style={style}
    >
      {tone === 'error' && <CircleAlert size={16} strokeWidth={2} aria-hidden="true" />}
      {check && <Check size={16} strokeWidth={3} aria-hidden="true" />}
      {tone === 'working' && <ProgressDots size="sm" />}
      <span>{children}</span>
    </span>
  )
}
