/** Test-only builders for the generation service: an empty lesson, a recording AI, events. */
import type { AiService } from '@shared/ai/types'
import { createFakeAiService, type FakeAiOptions } from '../../ai/fake'
import { makeServicesRig, type ServicesRig } from '../chat/testing'
import type { GenerationServiceDeps } from './service'
import { GenerationService } from './service'

export interface GenerationRig extends ServicesRig {
  generation: GenerationService
}

/**
 * A new EMPTY lesson without a typed title (so a generation may name it) in the Science KS3 style, the fake AI
 * (with `ai` overrides) and a GenerationService that records its events. `rig.lessonId` is that lesson.
 */
export async function makeGenerationRig(
  options: {
    ai?: Partial<AiService>
    fake?: FakeAiOptions
    deps?: Partial<GenerationServiceDeps>
  } = {}
): Promise<GenerationRig> {
  const rig = await makeServicesRig({ ai: options.ai, fake: options.fake })
  const created = await rig.service.create({ styleId: rig.style.id, meta: {}, title: null })
  if (!created.ok) throw new Error(created.message)
  const ai = { ...createFakeAiService(options.fake), ...options.ai }
  const generation = new GenerationService({
    lessons: rig.service,
    ai,
    chatLog: rig.store,
    emit: rig.emit,
    ...options.deps
  })
  return { ...rig, lessonId: created.lessonId, ai, generation }
}

/** Sleeps for `ms` (used to make fake AI calls overlap). */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
