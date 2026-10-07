/** 4.5 planLesson (streamed, validated, repaired once) and 4.6 writeSlide (one slide per call). */
import type { AssetCatalogue, CallOptions, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { aiError } from '../errors'
import { parsePartialJson } from '../json'
import { briefText, buildSystem, planText } from '../prompts/context'
import { PLAN_TASK, SLIDE_WRITER, WRITE_SLIDE_TASK } from '../prompts/system'
import { cached } from '../request'
import { planWire, toPlan } from '../schemas/lesson'
import { checkedSlide, writerSlideWire } from '../schemas/slide'
import type { ContentBlockParam, MessageParam } from '../sdk'
import { textBlock, type CallDeps } from './deps'
import { layoutFor, planProblems, repairLayouts } from './planRules'

export { layoutFor, planProblems, repairLayouts }

/** [A]+[B] slide-author prompt + [C] profile: identical for planLesson and every writeSlide, so they share a cache. */
const authorSystem = (profile: StyleProfile | null, assets?: string) =>
  buildSystem({ instructions: [SLIDE_WRITER], deckModel: true, profile, assets })

export async function planLesson(
  { runner }: CallDeps,
  input: { profile: StyleProfile | null; brief: LessonBrief },
  opts: CallOptions & { onProgress?: (message: string) => void } = {}
): Promise<{ plan: LessonPlan }> {
  const { profile, brief } = input
  const messages: MessageParam[] = [
    { role: 'user', content: [textBlock(briefText(brief)), textBlock(PLAN_TASK)] }
  ]
  const spec = {
    task: 'planLesson' as const,
    system: authorSystem(profile),
    schema: planWire,
    effort: 'medium' as const,
    maxTokens: 16_000,
    stream: true
  }

  opts.onProgress?.('Reading your objectives…')
  let seen = 0
  let streamed = ''
  const onText = opts.onProgress
    ? (delta: string): void => {
        streamed += delta
        const slides = (parsePartialJson(streamed) as { slides?: unknown[] } | undefined)?.slides
        if (Array.isArray(slides) && slides.length > seen) {
          seen = slides.length
          opts.onProgress?.(`Planning slide ${seen}…`)
        }
      }
    : undefined

  const first = await runner.runStructured({ ...spec, messages }, { signal: opts.signal, onText })
  let plan = toPlan(first.data)
  const problems = planProblems(plan, brief, profile)
  if (problems.length > 0) {
    opts.onProgress?.('Tidying the plan…')
    const repair: MessageParam[] = [
      ...messages,
      { role: 'assistant', content: first.message.content as ContentBlockParam[] },
      {
        role: 'user',
        content: [
          textBlock(
            `Fix these problems and return the complete plan again:\n- ${problems.join('\n- ')}`
          )
        ]
      }
    ]
    plan = toPlan(
      (await runner.runStructured({ ...spec, messages: repair }, { signal: opts.signal })).data
    )
  }
  return { plan: repairLayouts(plan, profile) }
}

export async function writeSlide(
  { runner, newId }: CallDeps,
  input: {
    profile: StyleProfile | null
    brief: LessonBrief
    plan: LessonPlan
    index: number
    assets?: AssetCatalogue
  },
  opts: CallOptions = {}
): Promise<{ slide: Slide }> {
  const { plan, index } = input
  const planned = plan.slides[index]
  if (!planned) throw aiError('unknown')
  const neighbour = (i: number): string => plan.slides[i]?.purpose ?? '(none)'
  const request = [
    `Write slide ${index + 1} of ${plan.slides.length}.`,
    `Kind: ${planned.kind}. Layout: ${planned.layoutId || '(none: use a clean default)'}.`,
    `Purpose: ${planned.purpose}`,
    `Key content:\n- ${planned.keyContent.join('\n- ')}`,
    planned.minutes ? `Timing: ${planned.minutes} minutes.` : '',
    `Objectives served (indexes): ${planned.objectiveRefs.join(', ') || 'none'}.`,
    `Previous slide: ${neighbour(index - 1)}`,
    `Next slide: ${neighbour(index + 1)}`
  ].filter(Boolean)

  // [D] is shared by every slide of the lesson (cache breakpoint); the slide request [F] is the volatile tail.
  const content: ContentBlockParam[] = [
    textBlock(WRITE_SLIDE_TASK),
    cached(textBlock(`${briefText(input.brief)}\n\n${planText(plan)}`)),
    textBlock(request.join('\n'))
  ]
  const { data } = await runner.runStructured(
    {
      task: 'writeSlide',
      system: authorSystem(input.profile, input.assets?.text),
      messages: [{ role: 'user', content }],
      schema: writerSlideWire,
      effort: 'medium',
      maxTokens: 12_000
    },
    opts
  )
  return { slide: checkedSlide(data, newId('sld'), input.assets) }
}
