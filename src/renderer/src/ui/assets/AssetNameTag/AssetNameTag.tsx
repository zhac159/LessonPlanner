import type { ReactNode } from 'react'
import { cx } from '../../atoms/cx'
import './AssetNameTag.css'

export interface AssetNameTagProps {
  /** `school_logo`, or `leaf_cross_section · fitted to region 1`. */
  children: ReactNode
  /** Announce changes politely (the live preview of A11 and A13). */
  live?: boolean
  className?: string
}

/** The small mono pill on the stage: the placed picture's chat name, or a preview note. */
export function AssetNameTag({ children, live = false, className }: AssetNameTagProps) {
  return (
    <span className={cx('as-nametag as-mono', className)} role={live ? 'status' : undefined}>
      {children}
    </span>
  )
}
