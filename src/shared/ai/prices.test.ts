import { describe, expect, it } from 'vitest'
import {
  EMPTY_USAGE,
  MODEL_LABELS,
  PRICES,
  addUsage,
  costOf,
  isModelChoice,
  priceFor
} from './prices'

describe('prices', () => {
  it('costs one million input and output tokens at the table rates', () => {
    const usage = { ...EMPTY_USAGE, inputTokens: 1_000_000, outputTokens: 1_000_000 }
    expect(costOf('claude-opus-5-5', usage)).toBeCloseTo(24)
    expect(costOf('claude-sonnet-5-5', usage)).toBeCloseTo(12)
  })

  it('prices cache reads and writes separately', () => {
    const usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 1_000_000
    }
    expect(costOf('claude-opus-5-5', usage)).toBeCloseTo(0.4 + 5)
  })

  it('costs an unknown model at the default model price', () => {
    expect(priceFor('claude-something-new')).toBe(PRICES['claude-opus-5-5'])
  })

  it('knows its model choices and has a label for each', () => {
    expect(isModelChoice('claude-sonnet-5-5')).toBe(true)
    expect(isModelChoice('gpt-4')).toBe(false)
    expect(isModelChoice(undefined)).toBe(false)
    for (const model of Object.keys(PRICES))
      expect(MODEL_LABELS[model as keyof typeof MODEL_LABELS]).toBeTruthy()
  })

  it('adds usages without mutating the inputs', () => {
    const a = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 }
    const sum = addUsage(a, a)
    expect(sum).toEqual({
      inputTokens: 2,
      outputTokens: 4,
      cacheReadTokens: 6,
      cacheWriteTokens: 8
    })
    expect(a.inputTokens).toBe(1)
  })
})
