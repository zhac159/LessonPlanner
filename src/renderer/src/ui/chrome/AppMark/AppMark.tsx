import { Pencil } from 'lucide-react'
import './AppMark.css'

/** The Slide Planner mark: an orange tile with a pencil. Decorative. */
export function AppMark({ size = 22 }: { size?: number }) {
  return (
    <span className="ui-app-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Pencil size={Math.round(size * 0.55)} strokeWidth={2.8} />
    </span>
  )
}
