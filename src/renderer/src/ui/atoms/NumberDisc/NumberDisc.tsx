import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../cx'
import './NumberDisc.css'

export interface NumberDiscProps {
  /** The numeral (or any short content). Ignored when `done`. */
  children?: ReactNode
  /** Rendered diameter in px, including the border. */
  size?: 20 | 22 | 30 | 32 | 36
  /** orange = current, white, a pastel, or `upcoming` (transparent with a muted ring). */
  tone?: 'orange' | 'white' | 'peach' | 'sky' | 'mint' | 'upcoming'
  /** Shows a check mark instead of the numeral. */
  done?: boolean
  className?: string
}

/** A circle with a bold centred numeral: step numbers, region numbers. */
export function NumberDisc({
  children,
  size = 30,
  tone = 'white',
  done = false,
  className
}: NumberDiscProps) {
  return (
    <span className={cx('ui-disc', className)} data-tone={done ? 'mint' : tone} data-size={size}>
      {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : children}
    </span>
  )
}
