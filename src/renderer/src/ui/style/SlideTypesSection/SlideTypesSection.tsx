import { StatusPill } from '../../atoms'
import { LearnedCard } from '../internal/LearnedCard'

export interface SlideTypesSectionProps {
  /** `profile.slideTypes[].name`, or null while nothing has been learned yet (skeleton tags). */
  names: readonly string[] | null
  className?: string
}

/** Tag tints, cycled in order. */
export const TAG_TINTS = [
  'var(--cat-sky)',
  'var(--cat-peach)',
  'var(--cat-mint)',
  'var(--cat-butter)',
  'var(--cat-lilac)'
] as const

/** The "Slide types you use" card: one tinted tag per slide type. */
export function SlideTypesSection({ names, className }: SlideTypesSectionProps) {
  return (
    <LearnedCard
      title="Slide types you use"
      items={names}
      layout="tags"
      className={className}
      itemKey={(name, index) => `${index}-${name}`}
      renderItem={(name, index) => (
        <StatusPill tone="tag" size="md" color={TAG_TINTS[index % TAG_TINTS.length]}>
          {name}
        </StatusPill>
      )}
    />
  )
}
