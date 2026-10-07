import { describe, expect, it } from 'vitest'
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import { fixtureProfile } from '../fake/fixtures'
import { sampleSlideWire } from '../sampleDrafts'
import { createRig, jsonMessage, textMessage } from '../testing'
import { defaultDeps, type CallDeps } from './deps'
import { layoutFor, planLesson, planProblems, repairLayouts, writeSlide } from './lesson'

/** What the writer is asked for: the shared sample plus the four writer-only fields (all empty). */
const writerWire = () => {
  const wire = sampleSlideWire()
  return {
    ...wire,
    elements: wire.elements.map((e) => ({
      ...e,
      assetName: '',
      spotKind: '',
      spotQuery: '',
      tail: ''
    }))
  }
}

const profile = fixtureProfile()
const brief: LessonBrief = {
  title: 'Photosynthesis',
  yearGroup: 'Y8',
  targetSlideCount: 3,
  objectives: ['Describe it', 'Write the equation']
}
const LAYOUT = 'content-text-left-image-right'

const planSlide = (over: Record<string, unknown> = {}) => ({
  kind: 'content',
  layoutId: LAYOUT,
  purpose: 'Teach it',
  keyContent: ['a'],
  minutes: 0,
  objectiveRefs: [0, 1],
  ...over
})
const wirePlan = (slides: unknown[]) => ({ title: 'Y8 Science', summary: 'A plan.', slides })

const depsFor = (script: Parameters<typeof createRig>[0]) => {
  const rig = createRig(script)
  const deps: CallDeps = { ...defaultDeps(rig.runner), newId: (p) => `${p}_new` }
  return { rig, deps }
}

const plan: LessonPlan = {
  title: 'T',
  summary: 's',
  slides: [
    { kind: 'title', layoutId: 'title', purpose: 'Open', keyContent: [], objectiveRefs: [] },
    {
      kind: 'content',
      layoutId: LAYOUT,
      purpose: 'Teach',
      keyContent: ['x', 'y'],
      minutes: 10,
      objectiveRefs: [0]
    },
    { kind: 'check', layoutId: LAYOUT, purpose: 'Check', keyContent: [], objectiveRefs: [0] }
  ]
}

describe('layoutFor', () => {
  it('picks the layout serving the kind, else the first, else empty', () => {
    expect(layoutFor('title', profile)).toBe('title')
    expect(layoutFor('quiz', profile)).toBe(profile.layouts[0].id)
    expect(layoutFor('title', null)).toBe('')
  })
})

describe('planProblems / repairLayouts', () => {
  it('reports uncovered objectives, unknown layouts and a wrong slide count', () => {
    const bad: LessonPlan = {
      ...plan,
      slides: [{ ...plan.slides[0], layoutId: 'nope' }, ...Array(6).fill(plan.slides[1])]
    }
    const problems = planProblems(bad, brief, profile)
    expect(problems.some((p) => p.includes('Objective 1'))).toBe(true)
    expect(problems.some((p) => p.includes('"nope"'))).toBe(true)
    expect(problems.some((p) => p.includes('target is 3'))).toBe(true)
  })

  it('is quiet for a good plan, and ignores layouts without a profile', () => {
    const good = { ...plan, slides: plan.slides.map((s) => ({ ...s, objectiveRefs: [0, 1] })) }
    expect(planProblems(good, brief, profile)).toEqual([])
    expect(
      planProblems(
        { ...good, slides: [{ ...good.slides[0], layoutId: '' }, ...good.slides.slice(1)] },
        brief,
        null
      )
    ).toEqual([])
  })

  it('does not demand layouts from a style that was learned without any', () => {
    const good = {
      ...plan,
      slides: plan.slides.map((s) => ({ ...s, objectiveRefs: [0, 1], layoutId: '' }))
    }
    expect(planProblems(good, brief, { ...profile, layouts: [] })).toEqual([])
  })

  it('replaces unknown layout ids by the best layout for the kind', () => {
    const fixed = repairLayouts(
      { ...plan, slides: [{ ...plan.slides[0], layoutId: 'ghost' }] },
      profile
    )
    expect(fixed.slides[0].layoutId).toBe('title')
    expect(repairLayouts(plan, null)).toEqual(plan)
  })
})

describe('planLesson', () => {
  const good = wirePlan([
    planSlide({ kind: 'title', layoutId: 'title' }),
    planSlide(),
    planSlide({ kind: 'check' })
  ])

  it('streams at medium effort with the profile cached and returns the plan', async () => {
    const { rig, deps } = depsFor([jsonMessage(good)])
    const progress: string[] = []
    const { plan: result } = await planLesson(
      deps,
      { profile, brief },
      { onProgress: (m) => progress.push(m) }
    )
    expect(result.slides).toHaveLength(3)
    const request = rig.stub.requests[0]
    expect(rig.stub.streamed).toEqual([true])
    expect(request.output_config?.effort).toBe('medium')
    const system = request.system as Array<{ cache_control?: unknown }>
    expect(system.map((s) => s.cache_control)).toEqual([
      { type: 'ephemeral' },
      { type: 'ephemeral' }
    ])
    expect(progress[0]).toBe('Reading your objectives…')
    expect(progress.some((p) => p.startsWith('Planning slide'))).toBe(true)
  })

  it('makes one repair request listing the problems when validation fails', async () => {
    const bad = wirePlan([
      planSlide({ objectiveRefs: [0] }),
      planSlide({ objectiveRefs: [0] }),
      planSlide({ objectiveRefs: [0] })
    ])
    const { rig, deps } = depsFor([jsonMessage(bad), jsonMessage(good)])
    const { plan: result } = await planLesson(deps, { profile, brief })
    expect(rig.stub.requests).toHaveLength(2)
    const repair = rig.stub.requests[1].messages
    expect(repair.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(JSON.stringify(repair[2])).toContain('Objective 1')
    expect(result.slides[0].kind).toBe('title')
  })

  it('stops after one repair and fixes layout ids locally', async () => {
    const stillBad = wirePlan([planSlide({ layoutId: 'ghost', objectiveRefs: [0] })])
    const { rig, deps } = depsFor([jsonMessage(stillBad), jsonMessage(stillBad)])
    const { plan: result } = await planLesson(deps, { profile, brief })
    expect(rig.stub.requests).toHaveLength(2)
    expect(result.slides[0].layoutId).toBe(LAYOUT)
  })

  it('works without a profile or a progress listener', async () => {
    const noProfile = wirePlan([planSlide({ layoutId: '' })])
    const { rig, deps } = depsFor([jsonMessage(noProfile)])
    const { plan: result } = await planLesson(deps, {
      profile: null,
      brief: { objectives: ['a', 'b'] }
    })
    expect(result.slides).toHaveLength(1)
    expect(JSON.stringify(rig.stub.requests[0].system)).toContain('No style profile yet')
  })
})

describe('writeSlide', () => {
  it('shares a cached lesson block, keeps the slide request last, and maps the slide', async () => {
    const { rig, deps } = depsFor([jsonMessage(writerWire())])
    const { slide } = await writeSlide(deps, { profile, brief, plan, index: 1 })
    expect(slide.id).toBe('sld_new')
    expect(slide.elements[0].id).toBe('sld_new-e1')
    const request = rig.stub.requests[0]
    const content = request.messages[0].content as Array<{ text: string; cache_control?: unknown }>
    expect(content.map((b) => Boolean(b.cache_control))).toEqual([false, true, false])
    expect(content[1].text).toContain('Lesson plan')
    expect(content[2].text).toContain('Write slide 2 of 3')
    expect(content[2].text).toContain('Previous slide: Open')
    expect(content[2].text).toContain('Next slide: Check')
    expect(request.output_config?.effort).toBe('medium')
    expect(rig.stub.streamed).toEqual([false])
  })

  it('uses the same system prompt as planning so the cache is shared', async () => {
    const { rig, deps } = depsFor([jsonMessage(wirePlan([planSlide()])), jsonMessage(writerWire())])
    await planLesson(deps, { profile, brief: { objectives: ['a'] } })
    await writeSlide(deps, { profile, brief, plan, index: 0 })
    expect(rig.stub.requests[1].system).toEqual(rig.stub.requests[0].system)
  })

  it('rejects an index outside the plan without calling the API', async () => {
    const { rig, deps } = depsFor([textMessage('x')])
    await expect(writeSlide(deps, { profile, brief, plan, index: 9 })).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
    expect(rig.stub.requests).toHaveLength(0)
  })
})
