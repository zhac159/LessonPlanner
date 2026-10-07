import { X } from 'lucide-react'
import { cx } from '../../atoms/cx'
import { Thumb } from '../internal/Thumb'
import './BasedOnStrip.css'

export interface BasedOnItem {
  id: string
  name: string
  thumbSrc?: string | null
}

export interface BasedOnStripProps {
  items: readonly BasedOnItem[]
  /** × on a thumbnail unticks it. Leave out for a fixed list. */
  onRemove?: (id: string) => void
  label?: string
  className?: string
}

/** "Based on": the pictures whose look is copied, as small tiles with a round × (28 px). */
export function BasedOnStrip({
  items,
  onRemove,
  label = 'Based on',
  className
}: BasedOnStripProps) {
  return (
    <section className={cx('as-basedon', className)} aria-label={label}>
      <h3 className="as-basedon__label">{label}</h3>
      {items.length === 0 ? (
        <p className="as-basedon__empty">Tick a few assets to show the look you want.</p>
      ) : (
        <ul className="as-basedon__list">
          {items.map((item) => (
            <li key={item.id} className="as-basedon__item">
              <Thumb src={item.thumbSrc} className="as-basedon__thumb" />
              <span className="as-sr-only">{item.name}</span>
              {onRemove && (
                <button
                  type="button"
                  className="as-basedon__x"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <X size={14} strokeWidth={2.6} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
