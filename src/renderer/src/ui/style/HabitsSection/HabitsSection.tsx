import { Check } from 'lucide-react'
import { LearnedCard } from '../internal/LearnedCard'
import './HabitsSection.css'

export interface HabitsSectionProps {
  /** `profile.habits`, or null while nothing has been learned yet (skeleton rows). */
  habits: readonly string[] | null
  className?: string
}

/** Rows shown before "Show all". */
export const HABIT_LIMIT = 6

/** The "Layout habits" card: one tick per habit. */
export function HabitsSection({ habits, className }: HabitsSectionProps) {
  return (
    <LearnedCard
      title="Layout habits"
      items={habits}
      limit={HABIT_LIMIT}
      className={className}
      itemKey={(habit, index) => `${index}-${habit}`}
      renderItem={(habit) => (
        <span className="habit">
          <Check size={16} strokeWidth={3} aria-hidden="true" />
          <span>{habit}</span>
        </span>
      )}
    />
  )
}
