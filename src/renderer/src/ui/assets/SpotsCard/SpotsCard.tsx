import { Check, Image as ImageIcon } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import { spotsLabel } from '../internal/format'
import './SpotsCard.css'

export interface SpotsCardProps {
  /** How many spots are still empty (live). 0 turns the card mint. */
  count: number
  onFillFirst: () => void
  className?: string
}

/** The dashed card in the chat: "3 picture spots to fill" and "Fill the first one"; mint when all are filled. */
export function SpotsCard({ count, onFillFirst, className }: SpotsCardProps) {
  const done = count === 0
  return (
    <section
      className={cx('as-spots', className)}
      data-state={done ? 'done' : 'open'}
      aria-label="Picture spots"
    >
      {done ? (
        <Check size={20} strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <ImageIcon size={20} aria-hidden="true" />
      )}
      <p className="as-spots__text" aria-live="polite">
        {done ? 'All picture spots are filled.' : spotsLabel(count)}
      </p>
      {!done && (
        <Button size="sm" variant="primary" onClick={onFillFirst}>
          Fill the first one
        </Button>
      )}
    </section>
  )
}
