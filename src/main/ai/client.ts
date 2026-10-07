/**
 * The ONE place that builds the Anthropic SDK client (design/ai-pipeline.md §1): same timeouts and headers for
 * every call, retries disabled in the SDK because `withRetry` (errors.ts) owns them. The key is fetched per
 * call from `getApiKey()` and never cached or stored on a long-lived object.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ModelChoice } from '@shared/ai/types'
import { aiError } from './errors'
import type { ClaudeClient } from './sdk'

export const DEFAULT_TIMEOUT_MS = 120_000
/** Streaming calls may legitimately run for minutes; the SDK default is 10 min. */
export const STREAM_TIMEOUT_MS = 600_000
export const TEST_TIMEOUT_MS = 15_000

export interface ClientProviderDeps {
  /** The decrypted key, or null when none is saved. Called on every request. */
  getApiKey(): string | null | Promise<string | null>
  getModel(): ModelChoice
  /** Test seam: build a client for a key. Defaults to the real SDK. */
  createClient?(apiKey: string): ClaudeClient
}

export interface ClientProvider {
  /** A client for the current key; throws `AiCallError('no-key')` when there is none. */
  acquire(): Promise<ClaudeClient>
  model(): ModelChoice
}

/** Real SDK client: no SDK-level retries (we retry in one place), common headers. */
export function createSdkClient(apiKey: string): ClaudeClient {
  return new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: DEFAULT_TIMEOUT_MS,
    defaultHeaders: { 'x-app': 'slide-planner' }
  })
}

export function createClientProvider(deps: ClientProviderDeps): ClientProvider {
  const create = deps.createClient ?? createSdkClient
  return {
    async acquire() {
      const key = await deps.getApiKey()
      if (!key) throw aiError('no-key')
      return create(key)
    },
    model: () => deps.getModel()
  }
}
