/**
 * The real `AiService`: each method runs its call inside `guarded`, so callers always get a `Result`
 * (a friendly `Failure`, never a thrown SDK error).
 */
import { CHEAPER_MODEL } from '@shared/ai/prices'
import type { AiService } from '@shared/ai/types'
import { chatTurn } from './chat/loop'
import { testConnection } from './calls/connection'
import { defaultDeps, type CallDeps } from './calls/deps'
import { planLesson, writeSlide } from './calls/lesson'
import { extractObjectives } from './calls/objectives'
import {
  describeAssets,
  describeStyleOfAssets,
  createMemoryDescribeCache,
  drawSvg,
  type DescribeCache
} from './calls/pictures'
import { analyseStyleFile } from './calls/styleFile'
import { applyStyleCorrection, synthesiseProfile } from './calls/styleProfile'
import { structured } from './calls/structured'
import { guarded } from './errors'
import type { Runner } from './runner'

export function createRealAiService(
  runner: Runner,
  overrides: Partial<CallDeps> = {},
  extras: { describeCache?: DescribeCache } = {}
): AiService {
  const deps: CallDeps = { ...defaultDeps(runner), ...overrides }
  const model = (): string => runner.model()
  const describeCache = extras.describeCache ?? createMemoryDescribeCache()
  return {
    testConnection: (opts) =>
      guarded(() => testConnection(runner, opts), { model: opts?.model ?? model() }),
    analyseStyleFile: (input, opts) =>
      guarded(() => analyseStyleFile(deps, input, opts), { model: model() }),
    synthesiseProfile: (input, opts) =>
      guarded(() => synthesiseProfile(deps, input, opts), { model: model() }),
    applyStyleCorrection: (input, opts) =>
      guarded(() => applyStyleCorrection(deps, input, opts), { model: model() }),
    extractObjectives: (input, opts) =>
      guarded(() => extractObjectives(deps, input, opts), { model: model() }),
    planLesson: (input, opts) => guarded(() => planLesson(deps, input, opts), { model: model() }),
    writeSlide: (input, opts) => guarded(() => writeSlide(deps, input, opts), { model: model() }),
    chatTurn: (input, sink, opts) =>
      guarded(() => chatTurn(deps, input, sink, opts), { model: model() }),
    describeAssets: (input, opts) =>
      guarded(() => describeAssets(deps, input, opts, describeCache), { model: CHEAPER_MODEL }),
    describeStyleOfAssets: (input, opts) =>
      guarded(() => describeStyleOfAssets(deps, input, opts), { model: CHEAPER_MODEL }),
    drawSvg: (input, opts) => guarded(() => drawSvg(deps, input, opts), { model: CHEAPER_MODEL }),
    structured: (request, opts) =>
      guarded(() => structured(deps, request, opts), { model: model() })
  }
}
