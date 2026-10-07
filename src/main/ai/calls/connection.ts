/** 4.9 testConnection: one tiny real request that proves the key, the credit and access to the model. */
import type { CallOptions, ModelChoice } from '@shared/ai/types'
import { TEST_TIMEOUT_MS } from '../client'
import { TEST_PROMPT } from '../prompts/system'
import type { Runner } from '../runner'

export async function testConnection(
  runner: Runner,
  opts: CallOptions & { model?: ModelChoice } = {}
): Promise<{ model: string; latencyMs: number }> {
  const model = opts.model ?? runner.model()
  const started = Date.now()
  await runner.run(
    {
      task: 'testConnection',
      system: [{ text: 'You are a connection test for a desktop app.' }],
      messages: [{ role: 'user', content: TEST_PROMPT }],
      effort: 'low',
      maxTokens: 16,
      model,
      fallbacks: false,
      retry: false,
      retryOnMaxTokens: false,
      timeoutMs: TEST_TIMEOUT_MS
    },
    { signal: opts.signal }
  )
  return { model, latencyMs: Date.now() - started }
}
