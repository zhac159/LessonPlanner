import { Image as ImageIcon, MessageSquare, X } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { Button } from '../../atoms/Button/Button'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { cx } from '../../atoms/cx'
import './RegionActionBar.css'

export interface RegionActionBarProps {
  /** The region's number: names the toolbar "Region 1". */
  regionNumber: number
  onAddAsset: () => void
  onAskClaude: () => void
  /** × and Esc: hide the bar only; the region and its chip stay. */
  onDismiss: () => void
  /** Focus "Add asset here" when the bar opens from the keyboard. */
  autoFocus?: boolean
  /** The caller positions it near the loop (clamped inside the stage). */
  style?: CSSProperties
  className?: string
}

/** The floating bar by a circled area: "Add asset here", "Ask Claude" and ×. */
export function RegionActionBar({
  regionNumber,
  onAddAsset,
  onAskClaude,
  onDismiss,
  autoFocus = false,
  style,
  className
}: RegionActionBarProps) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (autoFocus) root.current?.querySelector<HTMLElement>('button')?.focus()
  }, [autoFocus])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onDismiss()
      return
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const buttons = Array.from(root.current?.querySelectorAll<HTMLElement>('button') ?? [])
    const at = buttons.indexOf(event.target as HTMLElement)
    if (at < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    buttons[(at + step + buttons.length) % buttons.length]?.focus()
  }

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label={`Region ${regionNumber}`}
      className={cx('as-region-bar', className)}
      style={style}
      onKeyDown={onKeyDown}
    >
      <Button size="sm" variant="primary" icon={<ImageIcon />} onClick={onAddAsset}>
        Add asset here
      </Button>
      <Button size="sm" variant="secondary" icon={<MessageSquare />} onClick={onAskClaude}>
        Ask Claude
      </Button>
      <IconButton aria-label="Hide these options" variant="ghost" onClick={onDismiss}>
        <X strokeWidth={2.4} />
      </IconButton>
    </div>
  )
}
