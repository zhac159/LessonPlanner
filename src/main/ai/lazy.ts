/**
 * An `AiService` that builds the real one on first use. The Anthropic SDK and the whole Claude call layer are
 * large; most launches never talk to Claude, so they are not loaded (parsed, evaluated) at startup.
 * Every `AiService` method returns a promise, so deferring them behind one `import()` is invisible to callers.
 */
import type { AiService } from '@shared/ai/types'

export function lazyAiService(load: () => Promise<AiService>): AiService {
  let loaded: Promise<AiService> | undefined
  const target = (): Promise<AiService> => (loaded ??= load())
  return new Proxy({} as AiService, {
    get:
      (_target, method) =>
      async (...args: unknown[]) => {
        const service = await target()
        return (service[method as keyof AiService] as (...a: unknown[]) => unknown)(...args)
      }
  })
}
