/**
 * `createFakeAiService()`: a deterministic `AiService` built from the design fixtures. Used for tests, demos and
 * the end-to-end flows (`SLIDE_PLANNER_FAKE_AI=1`), so no key and no network are needed.
 *
 * Options: `delayMs` (pause before each answer, for progress UIs), `failWith` (every call fails with that code,
 * for error states). Every method honours `signal` (cancelled -> `cancelled` failure).
 */
import { aiFailure, cancelledFailure } from '@shared/ai/errors'
import { EMPTY_USAGE } from '@shared/ai/prices'
import type { AiService, Usage } from '@shared/ai/types'
import { newId } from '@shared/ids'
import { fail, ok, type AiErrorCode, type Result } from '@shared/result'
import { fakeChatTurn } from './fake/chat'
import { fixtureSlide } from './fake/fixtures'
import { fakeDescribe, fakeStyleDescription, fakeSvgs } from './fake/pictures'
import { fakeStructuredReply } from './fake/structured'
import { fakeObjectives, fakePlan, fakeSlide } from './fake/lesson'
import { fakeAnalysis, fakeCorrection, fakePartials, fakeProfile, isBrokenFile } from './fake/style'

export interface FakeAiOptions {
  /** Milliseconds to wait before each answer (default 0). */
  delayMs?: number
  /** Make every call fail with this code. */
  failWith?: AiErrorCode
  /** What `structured()` answers (validated against the caller's schema): a value or a function of the request. Default: a canned reply the schema accepts (the Quiz questions), else `{}`. */
  structuredReply?: unknown
  now?: () => Date
}

const pause = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      },
      { once: true }
    )
  })

export function createFakeAiService(options: FakeAiOptions = {}): AiService {
  const now = options.now ?? (() => new Date())
  const delayMs = options.delayMs ?? 0
  const usage: Usage = { ...EMPTY_USAGE }

  /** Cancellation, error injection and delay in one place; then the method body. */
  async function answer<T extends object>(
    signal: AbortSignal | undefined,
    body: () => Result<T> | Promise<Result<T>>,
    model?: string
  ): Promise<Result<T>> {
    if (signal?.aborted) return cancelledFailure()
    if (options.failWith) return aiFailure(options.failWith, { model })
    if (delayMs > 0) {
      try {
        await pause(delayMs, signal)
      } catch {
        return cancelledFailure()
      }
    }
    return body()
  }

  return {
    testConnection: (opts) =>
      answer(
        opts?.signal,
        () => ok({ model: opts?.model ?? 'claude-opus-5-5', latencyMs: 0 }),
        opts?.model
      ),

    analyseStyleFile: (input, opts) =>
      answer(opts?.signal, () =>
        isBrokenFile(input.fileName)
          ? aiFailure('unknown')
          : ok({ analysis: fakeAnalysis(input.fileName) })
      ),

    synthesiseProfile: (input, opts) =>
      answer(opts?.signal, async () => {
        const profile = fakeProfile(input.name, input.existing, now().toISOString(), () =>
          newId('sty')
        )
        for (const partial of fakePartials(profile)) {
          opts?.onPartial?.(partial)
          if (delayMs > 0) await pause(delayMs / 3, opts?.signal).catch(() => undefined)
        }
        const testSlide = { ...fixtureSlide(1), id: newId('sld') }
        return ok({ profile, testSlide })
      }),

    applyStyleCorrection: (input, opts) =>
      answer(opts?.signal, () =>
        ok(fakeCorrection(input.profile, input.correction, now().toISOString()))
      ),

    extractObjectives: (input, opts) =>
      answer(opts?.signal, () =>
        !input.text?.trim() && !input.pdf && input.pptxDigest === undefined
          ? fail('invalid-input', 'There is nothing to read yet.')
          : ok({ extracted: fakeObjectives(input.text) })
      ),

    planLesson: (input, opts) =>
      answer(opts?.signal, () => {
        opts?.onProgress?.('Reading your objectives…')
        const plan = fakePlan(input.profile, input.brief)
        opts?.onProgress?.(`Planning ${plan.slides.length} slides…`)
        return ok({ plan })
      }),

    writeSlide: (input, opts) =>
      answer(opts?.signal, () =>
        input.index < 0 || input.index >= input.plan.slides.length
          ? aiFailure('unknown')
          : ok({ slide: fakeSlide(input.profile, input.plan, input.index, newId('sld')) })
      ),

    chatTurn: (input, sink, opts) =>
      answer(opts?.signal, () => fakeChatTurn(input, sink, { now, newId })),

    describeAssets: (input, opts) =>
      answer(opts?.signal, () => fakeDescribe(input.images, input.taken)),

    describeStyleOfAssets: (input, opts) =>
      answer(opts?.signal, () => fakeStyleDescription(input.images.length)),

    drawSvg: (input, opts) => answer(opts?.signal, () => fakeSvgs(input)),

    structured: (request, opts) =>
      answer(opts?.signal, () => {
        const reply = options.structuredReply
        const candidate =
          typeof reply === 'function' ? reply(request) : (reply ?? fakeStructuredReply(request))
        const parsed = request.schema.safeParse(candidate)
        return parsed.success
          ? ok({ data: parsed.data, usage })
          : fail('unknown', 'The demo AI cannot fill this schema.')
      })
  }
}
