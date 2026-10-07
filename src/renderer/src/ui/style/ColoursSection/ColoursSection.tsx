import type { StyleProfileView } from '@shared/contracts/style-library'
import { ColourRole } from '../ColourRole/ColourRole'
import { LearnedCard } from '../internal/LearnedCard'

export interface ColoursSectionProps {
  /** The learned colours, or null while nothing has been learned yet (skeleton rows). */
  colours: StyleProfileView['colours'] | null
  className?: string
}

/** Rows shown before "Show all". */
export const COLOUR_LIMIT = 6

/** The "Colours" card of "What I've learned so far". */
export function ColoursSection({ colours, className }: ColoursSectionProps) {
  return (
    <LearnedCard
      title="Colours"
      items={colours}
      limit={COLOUR_LIMIT}
      className={className}
      itemKey={(colour, index) => `${colour.token}-${index}`}
      renderItem={(colour) => (
        <ColourRole hex={colour.hex} label={colour.label} usage={colour.usage} />
      )}
    />
  )
}
