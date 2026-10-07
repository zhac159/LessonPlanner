/** The real Claude-backed `AiService`; loaded on first use through `lazyAiService` (see lazy.ts). */
import type { AiService } from '@shared/ai/types'
import { DEFAULT_MODEL } from '@shared/ai/prices'
import { createClientProvider } from './client'
import { Runner } from './runner'
import { createRealAiService } from './service'
import type { AiServiceDeps } from './index'

export function buildRealAiService(deps: AiServiceDeps): AiService {
  const provider = createClientProvider({
    getApiKey: deps.getApiKey ?? (() => null),
    getModel: deps.getModel ?? (() => DEFAULT_MODEL),
    createClient: deps.createClient
  })
  return createRealAiService(
    new Runner({ provider, usage: deps.usage, sleep: deps.sleep }),
    {},
    { describeCache: deps.describeCache }
  )
}
