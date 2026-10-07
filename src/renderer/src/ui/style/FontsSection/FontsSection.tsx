import type { StyleProfileView } from '@shared/contracts/style-library'
import { FontSample } from '../FontSample/FontSample'
import { LearnedCard } from '../internal/LearnedCard'

export interface FontsSectionProps {
  /** The learned fonts, or null while nothing has been learned yet (skeleton rows). */
  fonts: StyleProfileView['fonts'] | null
  /** The profile's text colour (hex) for the "Aa" tiles. */
  textColour?: string
  className?: string
}

/** The "Fonts" card of "What I've learned so far". */
export function FontsSection({ fonts, textColour, className }: FontsSectionProps) {
  return (
    <LearnedCard
      title="Fonts"
      items={fonts}
      className={className}
      itemKey={(font, index) => `${font.use}-${font.family}-${index}`}
      renderItem={(font) => <FontSample {...font} textColour={textColour} />}
    />
  )
}
