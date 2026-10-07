/** The two model choices as the Connect Claude Select shows them (design/screens/02-connect-claude.md §5). */
import type { ModelChoice } from '@shared/contracts/settings'

export const MODEL_OPTIONS: ReadonlyArray<{ value: ModelChoice; label: string }> = [
  { value: 'opus-5.5', label: 'Claude Opus 5.5 — best quality (recommended)' },
  { value: 'sonnet-5.5', label: 'Claude Sonnet 5.5 — faster and cheaper' }
]

const NAMES: Record<ModelChoice, string> = {
  'opus-5.5': 'Claude Opus 5.5',
  'sonnet-5.5': 'Claude Sonnet 5.5'
}

/** The plain model name for helper text ("This key can’t use Claude Sonnet 5.5."). */
export const modelName = (model: ModelChoice): string => NAMES[model]

export const isModelChoice = (value: string): value is ModelChoice => value in NAMES
