/**
 * Entry point of the AI layer: `createAiService(...)` returns the `AiService` the modules use.
 *
 *   createAiService({ getApiKey, getModel, usage })                       // real Claude
 *   createAiService({ fake: process.env.SLIDE_PLANNER_FAKE_AI === '1' })  // deterministic fixtures, no network
 *
 * Feature code depends on the `AiService` interface only (src/shared/ai/types.ts).
 */
import type { AiService, ModelChoice } from '@shared/ai/types'
import type { UsageSink } from '../services/usageLog'
import type { DescribeCache } from './calls/pictures'
import type { ClientProviderDeps } from './client'
import { createFakeAiService, type FakeAiOptions } from './fake'
import type { Sleep } from './errors'
import { lazyAiService } from './lazy'

export interface AiServiceDeps {
  /** The decrypted key (read on every call, never cached); null/absent = not connected. */
  getApiKey?: ClientProviderDeps['getApiKey']
  /** The model the teacher chose in Settings (read on every call). */
  getModel?: () => ModelChoice
  /** Where per-call token usage is recorded (`UsageLog`). */
  usage?: UsageSink
  /** Where picture descriptions are remembered by sha256 (default: in memory, lost on restart). */
  describeCache?: DescribeCache
  /** `true` or fake options: use the deterministic fake instead of Claude. */
  fake?: boolean | FakeAiOptions
  /** Test seams. */
  createClient?: ClientProviderDeps['createClient']
  sleep?: Sleep
}

export function createAiService(deps: AiServiceDeps = {}): AiService {
  if (deps.fake) return createFakeAiService(deps.fake === true ? {} : deps.fake)
  // The SDK and the call layer load on the first call, not at startup.
  return lazyAiService(async () => (await import('./real')).buildRealAiService(deps))
}

export { createFakeAiService, type FakeAiOptions } from './fake'
export type { DescribeCache } from './calls/pictures'
