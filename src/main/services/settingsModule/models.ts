/**
 * The ONE table that maps the model names the UI knows ('opus-5.5') to the API model ids the AI layer
 * sends ('claude-opus-5-5') (design/screens/02-connect-claude.md §6). Re-check the ids when models change.
 */
import { DEFAULT_MODEL } from '@shared/ai/prices'
import type { ModelChoice as ApiModel } from '@shared/ai/types'
import type { ModelChoice } from '@shared/contracts/settings'

export const MODEL_API_IDS: Readonly<Record<ModelChoice, ApiModel>> = {
  'opus-5.5': 'claude-opus-5-5',
  'sonnet-5.5': 'claude-sonnet-5-5'
}

/** The UI's name for a model choice, or null for anything else (renderer input is untrusted). */
export const isUiModel = (value: unknown): value is ModelChoice =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(MODEL_API_IDS, value)

/** The API id behind a UI choice. */
export const toApiModel = (choice: ModelChoice): ApiModel => MODEL_API_IDS[choice]

/** The UI choice for a stored or returned API id; unknown ids fall back to the default model's choice. */
export function toUiModel(apiId: string): ModelChoice {
  const found = (Object.keys(MODEL_API_IDS) as ModelChoice[]).find(
    (choice) => MODEL_API_IDS[choice] === apiId
  )
  return found ?? toUiModel(DEFAULT_MODEL)
}
