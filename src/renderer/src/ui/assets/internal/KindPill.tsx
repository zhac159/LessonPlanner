import { ASSET_KIND_LABELS, type AssetKind } from '@shared/assets/types'
import { cx } from '../../atoms/cx'
import './internal.css'

export interface KindPillProps {
  kind: AssetKind
  className?: string
}

/** The small coloured "Logo" / "Icon" / "Diagram" pill. */
export function KindPill({ kind, className }: KindPillProps) {
  return (
    <span className={cx('as-kind', className)} data-kind={kind}>
      {ASSET_KIND_LABELS[kind]}
    </span>
  )
}
