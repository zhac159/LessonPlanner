import { Pencil } from 'lucide-react'
import { useId } from 'react'
import { Button } from '../../atoms/Button/Button'
import { cx } from '../../atoms/cx'
import { IconButton } from '../../atoms/IconButton/IconButton'
import { StatusPill } from '../../atoms/StatusPill/StatusPill'
import { SwatchStack } from '../../atoms/SwatchStack/SwatchStack'
import './StyleCard.css'

export interface StyleCardProps {
  name: string
  /** Title font family, first in the meta line: "Lexend". */
  titleFont?: string
  /** How many decks the style was learned from. */
  deckCount: number
  /** CSS colours for the swatch stack, most important first. */
  swatches: ReadonlyArray<string>
  /** The default style: teal card with an inverse "Default" pill. */
  isDefault?: boolean
  /** `learning` swaps the trailing pill for a working "Learning…" pill. */
  status?: 'draft' | 'learning' | 'ready' | 'failed'
  /** The whole card links to the style. */
  onOpen: () => void
  /** Adds an "Edit {name}" icon button beside the card. */
  onEdit?: () => void
  /** Adds a "Set as default" button (not shown on the default style). */
  onSetDefault?: () => void
  className?: string
}

function metaLine(titleFont: string | undefined, deckCount: number): string {
  const learned =
    deckCount > 0 ? `learned from ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'}` : ''
  return [titleFont, learned].filter(Boolean).join(' · ')
}

/** A style in a list: swatches, name, "Lexend · learned from 24 decks" and a Default or Learning pill. */
export function StyleCard({
  name,
  titleFont,
  deckCount,
  swatches,
  isDefault = false,
  status = 'ready',
  onOpen,
  onEdit,
  onSetDefault,
  className
}: StyleCardProps) {
  const id = useId()
  const learning = status === 'learning'
  const meta = metaLine(titleFont, deckCount)

  return (
    <article className={cx('style-card', className)} data-default={isDefault || undefined}>
      <button
        type="button"
        className="style-card__open"
        aria-labelledby={`${id}-name`}
        aria-describedby={meta ? `${id}-meta` : undefined}
        onClick={onOpen}
      >
        <SwatchStack colors={swatches} />
        <span className="style-card__text">
          <span id={`${id}-name`} className="style-card__name">
            {name}
          </span>
          {meta && (
            <span id={`${id}-meta`} className="style-card__meta">
              {meta}
            </span>
          )}
        </span>
        {learning ? (
          <StatusPill tone="working" size="sm">
            Learning…
          </StatusPill>
        ) : (
          isDefault && (
            <StatusPill tone="inverse" size="sm">
              Default
            </StatusPill>
          )
        )}
      </button>
      {(onEdit || (onSetDefault && !isDefault)) && (
        <span className="style-card__actions">
          {onSetDefault && !isDefault && (
            <Button size="sm" onClick={onSetDefault} aria-label={`Set as default, ${name}`}>
              Set as default
            </Button>
          )}
          {onEdit && (
            <IconButton variant="ghost" aria-label={`Edit ${name}`} onClick={onEdit}>
              <Pencil strokeWidth={2} />
            </IconButton>
          )}
        </span>
      )}
    </article>
  )
}
