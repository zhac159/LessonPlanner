import { cx } from '../cx'
import './Avatar.css'

export interface AvatarProps {
  /** The person's name: its first letter is shown and it becomes the accessible name. */
  name: string
  /** Diameter in px (36 in the sidebar). */
  size?: number
  className?: string
}

/** The user's initial in a lilac circle. */
export function Avatar({ name, size = 36, className }: AvatarProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  return (
    <span
      className={cx('ui-avatar', className)}
      role="img"
      aria-label={name}
      style={{ width: size, height: size }}
    >
      <span aria-hidden="true">{initial}</span>
    </span>
  )
}
