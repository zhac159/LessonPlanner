/** `structured`: the generic JSON-out call for plugins and future features (design/plugin-architecture.md). */
import type { CallOptions, StructuredRequest, Usage } from '@shared/ai/types'
import { buildSystem } from '../prompts/context'
import { SLIDE_WRITER } from '../prompts/system'
import type { ContentBlockParam } from '../sdk'
import { pngBlock, textBlock, type CallDeps } from './deps'

export async function structured<T>(
  { runner }: CallDeps,
  request: StructuredRequest<T>,
  opts: CallOptions = {}
): Promise<{ data: T; usage: Usage }> {
  const content: ContentBlockParam[] = [
    ...(request.images ?? []).map(pngBlock),
    textBlock(request.prompt)
  ]
  const { data, usage } = await runner.runStructured(
    {
      task: 'plugin',
      system: buildSystem({
        instructions: [request.profile ? SLIDE_WRITER : '', request.instructions].filter(Boolean),
        profile: request.profile
      }),
      messages: [{ role: 'user', content }],
      schema: request.schema,
      effort: request.effort ?? 'medium',
      maxTokens: request.maxTokens ?? 16_000
    },
    opts
  )
  return { data, usage }
}
