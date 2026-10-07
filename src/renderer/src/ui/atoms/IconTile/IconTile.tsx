import type { ReactNode } from 'react'
import { cx } from '../cx'
import './IconTile.css'

export interface IconTileProps {
  /** The icon (decorative; pass an unlabelled lucide icon). */
  children: ReactNode
  /** Edge length in px: 44 (header bands), 52 (card titles), 60 (Connect), 76 (empty state). */
  size?: 44 | 52 | 60 | 76
  tone?: 'white' | 'yellow' | 'orange' | 'peach' | 'butter'
  className?: string
}

/** A rounded square with an ink outline that holds one decorative icon. */
export function IconTile({ children, size = 52, tone = 'white', className }: IconTileProps) {
  return (
    <span
      className={cx('ui-icon-tile', className)}
      data-size={size}
      data-tone={tone}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
