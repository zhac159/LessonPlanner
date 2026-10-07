/**
 * Model ids and the ONE price table (design/ai-pipeline.md §10). When Anthropic changes prices or a model
 * is replaced, edit this file only. Prices are US dollars per million tokens (published API rates,
 * checked 2026-10-06; planning numbers, the Claude Console is the source of truth).
 */
import type { ModelChoice, Usage } from './types'

export const DEFAULT_MODEL: ModelChoice = 'claude-opus-5-5'
export const CHEAPER_MODEL: ModelChoice = 'claude-sonnet-5-5'

export const MODEL_LABELS: Readonly<Record<ModelChoice, string>> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5'
}

export interface ModelPrice {
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number
  /** 5-minute cache writes (1.25x input). */
  cacheWritePerMTok: number
}

export const PRICES: Readonly<Record<ModelChoice, ModelPrice>> = {
  'claude-opus-5-5': {
    inputPerMTok: 4,
    outputPerMTok: 20,
    cacheReadPerMTok: 0.2,
    cacheWritePerMTok: 5
  },
  'claude-sonnet-5-5': {
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheReadPerMTok: 0.2,
    cacheWritePerMTok: 2.5
  }
}

export const isModelChoice = (value: unknown): value is ModelChoice =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRICES, value)

/** Price for a model id; an unknown id is costed at the default (dearer) model so totals never under-report. */
export function priceFor(model: string): ModelPrice {
  return isModelChoice(model) ? PRICES[model] : PRICES[DEFAULT_MODEL]
}

/** Dollar cost of one response's usage. */
export function costOf(model: string, usage: Usage): number {
  const price = priceFor(model)
  return (
    (usage.inputTokens * price.inputPerMTok +
      usage.outputTokens * price.outputPerMTok +
      usage.cacheReadTokens * price.cacheReadPerMTok +
      usage.cacheWriteTokens * price.cacheWritePerMTok) /
    1_000_000
  )
}

export const EMPTY_USAGE: Readonly<Usage> = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0
}

/** Sum of two usages (new object). */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens
  }
}
