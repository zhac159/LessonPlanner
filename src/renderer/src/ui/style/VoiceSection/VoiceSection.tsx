import { LearnedCard } from '../internal/LearnedCard'
import './VoiceSection.css'

export interface VoiceSectionProps {
  /** `profile.voice.rules`, or null while nothing has been learned yet (skeleton rows). */
  rules: readonly string[] | null
  className?: string
}

/** Rows shown before "Show all". */
export const VOICE_LIMIT = 5

/** The "How you write" card: her writing rules as bullets. */
export function VoiceSection({ rules, className }: VoiceSectionProps) {
  return (
    <LearnedCard
      title="How you write"
      items={rules}
      limit={VOICE_LIMIT}
      className={className}
      itemKey={(rule, index) => `${index}-${rule}`}
      renderItem={(rule) => <span className="voice-rule">{rule}</span>}
    />
  )
}
