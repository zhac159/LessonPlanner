/** What the teacher reads for a picture maker model, and the credit line of a made picture (agents/ASSETS.md §3.8). */
import { VECTOR_MODEL } from '@shared/assets/pictureMaker'
import { attributionCredit } from '../../imageProviders/attribution'

const LABELS: Readonly<Record<string, string>> = {
  'gemini-3-pro-image': 'Nano Banana Pro',
  'gemini-nano-banana-2.1': 'Nano Banana 2.1',
  'gemini-3.1-flash-image': 'Nano Banana 2',
  'gemini-3.1-flash-lite-image': 'Nano Banana 2 Lite'
}

export const modelLabelOf = (model: string): string => LABELS[model] ?? model

/** "Picture made with Nano Banana Pro (AI-generated)." or "Picture drawn by Claude." */
export const madeCredit = (model: string): string =>
  model === VECTOR_MODEL
    ? 'Picture drawn by Claude.'
    : attributionCredit({ generatedBy: modelLabelOf(model) })
