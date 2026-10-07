/** 4.2 synthesiseProfile (streamed, live partials) and 4.3 applyStyleCorrection (JSON Patch). */
import { fail } from '@shared/result'
import type { CallOptions, FileAnalysis } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import { parseStyleProfile } from '@shared/style/schema'
import { aggregateAnalyses } from '@shared/style/votes'
import type { StyleProfile } from '@shared/style/types'
import { AiCallError, aiError } from '../errors'
import { applyPatch, PatchError } from '../jsonPatch'
import { parsePartialJson, stableStringify } from '../json'
import { buildSystem, profileForPrompt } from '../prompts/context'
import {
  CORRECTION_TASK,
  STYLE_ANALYST,
  SYNTHESIS_CORE_TASK,
  SYNTHESIS_LAYOUTS_TASK,
  SYNTHESIS_TASK
} from '../prompts/system'
import { patchWire } from '../schemas/lesson'
import { draftTestSlide, draftToProfile, partialProfile } from '../schemas/style'
import { styleCore, styleLayouts, type StyleDraft } from '../schemas/styleDraft'
import { textBlock, type CallDeps } from './deps'

/** Emit a partial profile at most every this many new characters of streamed JSON. */
const PARTIAL_EVERY_CHARS = 500
const PARA = '\n\n'

export async function synthesiseProfile(
  deps: CallDeps,
  input: { name: string; analyses: FileAnalysis[]; existing?: StyleProfile },
  opts: CallOptions & { onPartial?: (partial: Partial<StyleProfile>) => void } = {}
): Promise<{ profile: StyleProfile; testSlide: Slide }> {
  const shared = [
    `Style name: ${input.name}`,
    `Per-file analyses (${input.analyses.length} files):
${stableStringify(input.analyses)}`,
    `Vote counts across files (how many files agree):
${stableStringify(aggregateAnalyses(input.analyses))}`,
    input.existing
      ? `The teacher already has this profile; refine it with the new evidence and keep what still holds:
${stableStringify(profileForPrompt(input.existing))}`
      : '',
    SYNTHESIS_TASK
  ].filter(Boolean)
  const system = buildSystem({ instructions: [STYLE_ANALYST], deckModel: true })

  // Both steps stream; `base` is the finished step-1 data, so step 2's partials still show it.
  const streamer = (base: Record<string, unknown>) => {
    let streamed = ''
    let lastEmitted = 0
    let lastSent = ''
    return opts.onPartial
      ? (delta: string): void => {
          streamed += delta
          if (streamed.length - lastEmitted < PARTIAL_EVERY_CHARS) return
          lastEmitted = streamed.length
          const partial = partialProfile({ ...base, ...(parsePartialJson(streamed) as object) })
          const key = stableStringify(partial)
          if (key !== lastSent && key !== '{}') {
            lastSent = key
            opts.onPartial?.(partial)
          }
        }
      : undefined
  }

  const core = await deps.runner.runStructured(
    {
      task: 'synthesiseProfile',
      system,
      messages: [
        { role: 'user', content: [textBlock([...shared, SYNTHESIS_CORE_TASK].join(PARA))] }
      ],
      schema: styleCore,
      effort: 'high',
      maxTokens: 24_000,
      stream: true
    },
    { signal: opts.signal, onText: streamer({}) }
  )
  const layouts = await deps.runner.runStructured(
    {
      task: 'synthesiseProfile',
      system,
      messages: [
        {
          role: 'user',
          content: [
            textBlock(shared.join(PARA)),
            textBlock(
              `Step-1 profile:
${stableStringify(core.data)}

${SYNTHESIS_LAYOUTS_TASK}`
            )
          ]
        }
      ],
      schema: styleLayouts,
      effort: 'high',
      maxTokens: 16_000,
      stream: true
    },
    { signal: opts.signal, onText: streamer(core.data) }
  )
  const data: StyleDraft = { ...core.data, ...layouts.data }
  try {
    const profile = draftToProfile(data, {
      name: input.name,
      existing: input.existing,
      now: deps.now().toISOString(),
      newId: () => deps.newId('sty')
    })
    return { profile, testSlide: draftTestSlide(data, deps.newId('sld')) }
  } catch (error) {
    console.error(
      '[ai] synthesiseProfile: draft did not make a valid profile',
      error instanceof Error ? error.message : ''
    )
    throw aiError('unknown')
  }
}

/** Sections a correction may change. Everything else is the app's bookkeeping. */
const EDITABLE = new Set([
  'tokens',
  'components',
  'layouts',
  'slideTypes',
  'lessonFlow',
  'voice',
  'habits',
  'confidence',
  'pictures'
])

export const CORRECTION_FAILED =
  'I couldn’t apply that change to the style. Try wording it a different way.'

export async function applyStyleCorrection(
  deps: CallDeps,
  input: { profile: StyleProfile; correction: string },
  opts: CallOptions = {}
): Promise<{ profile: StyleProfile; message: string }> {
  const { data } = await deps.runner.runStructured(
    {
      task: 'applyStyleCorrection',
      system: buildSystem({ instructions: [STYLE_ANALYST, CORRECTION_TASK] }),
      messages: [
        {
          role: 'user',
          content: [
            textBlock(`Style profile JSON:\n${stableStringify(profileForPrompt(input.profile))}`),
            textBlock(`Her correction: ${input.correction}`)
          ]
        }
      ],
      schema: patchWire,
      effort: 'low',
      maxTokens: 4000
    },
    opts
  )
  try {
    for (const op of data.patch) {
      if (!EDITABLE.has(op.path.split('/')[1] ?? ''))
        throw new PatchError(`Not editable: ${op.path}`)
    }
    const patched = applyPatch(input.profile, data.patch)
    const version = input.profile.version + 1
    const profile = parseStyleProfile({
      ...patched,
      version,
      updatedAt: deps.now().toISOString(),
      corrections: [
        ...input.profile.corrections,
        { text: input.correction, at: deps.now().toISOString(), appliedInVersion: version }
      ]
    })
    return { profile, message: data.message }
  } catch {
    throw new AiCallError(fail('invalid-input', CORRECTION_FAILED))
  }
}
