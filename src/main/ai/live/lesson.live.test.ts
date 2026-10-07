/**
 * LIVE checks e, f: lesson planning and slide writing (incl. prompt-cache read on the second slide).
 * Run: npm run test:live -- lesson
 */
import { describe, expect, it } from 'vitest'
import type { LessonBrief, LessonPlan } from '@shared/ai/types'
import { slideSchema } from '@shared/deck/schema'
import { normaliseSlideInPlace } from '@shared/deck/normalise'
import type { Element, Paragraph, Slide } from '@shared/deck/types'
import { loadFixtureStyle } from '../../export/testkit'
import {
  createLiveService,
  hasKey,
  readArtifact,
  saveArtifact,
  SKIP_MESSAGE,
  unwrap,
  usageSeen
} from './harness'

const BRIEF: LessonBrief = {
  title: 'Photosynthesis',
  subject: 'Science (Biology)',
  yearGroup: 'Y8',
  durationMin: 50,
  targetSlideCount: 6,
  objectives: [
    'Describe the word equation for photosynthesis.',
    'Explain why plants need light, carbon dioxide and water.',
    'Investigate how light intensity affects the rate of photosynthesis.'
  ],
  context: 'Common misconception: plants get their food from the soil.'
}

const words = (text: string): number => text.split(/\s+/).filter(Boolean).length
const paraText = (p: Paragraph): string => p.runs.map((r) => r.text).join('')

/** Style/quality problems of a generated slide (empty = fine). */
function slideProblems(slide: Slide): string[] {
  const problems: string[] = []
  const hex = /#[0-9A-Fa-f]{3,8}\b/
  for (const el of slide.elements) {
    if (el.x < 0 || el.y < 0 || el.x + el.w > 1920 || el.y + el.h > 1080)
      problems.push(`${el.id} outside 1920x1080`)
    const json = JSON.stringify({ ...el, svg: undefined })
    if (hex.test(json)) problems.push(`${el.id} uses a hex colour`)
    if (el.type === 'text' && el.role === 'title') {
      const n = words(el.paragraphs.map(paraText).join(' '))
      if (n > 8) problems.push(`${el.id} title has ${n} words`)
    }
    if (el.type === 'text' && el.role === 'body') {
      const bullets = el.paragraphs.filter((p) => p.list === 'bullet' || p.list === 'number')
      if (bullets.length > 4) problems.push(`${el.id} has ${bullets.length} bullets`)
      for (const p of el.paragraphs)
        if (words(paraText(p)) > 12) problems.push(`${el.id} bullet over 12 words`)
    }
    if (el.type === 'callout') {
      const n = words(el.paragraphs.map(paraText).join(' '))
      if (n > 20) problems.push(`${el.id} callout has ${n} words`)
    }
  }
  return problems
}

describe.skipIf(!hasKey())('live: lesson planning and slide writing', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)

  it('e) planLesson covers all three objectives with the fixture style', async () => {
    const profile = loadFixtureStyle()
    const ai = createLiveService()
    const { plan } = unwrap(await ai.planLesson({ profile, brief: BRIEF }), 'planLesson')
    saveArtifact('e-plan.json', plan)
    expect(plan.slides.length).toBeGreaterThanOrEqual(4)
    expect(plan.slides.length).toBeLessThanOrEqual(8)
    const covered = new Set(plan.slides.flatMap((s) => s.objectiveRefs))
    for (const i of [0, 1, 2]) expect(covered.has(i), `objective ${i} covered`).toBe(true)
    const layouts = new Set(profile.layouts.map((l) => l.id))
    for (const s of plan.slides) expect(layouts.has(s.layoutId), s.layoutId).toBe(true)
  })

  it('f) writeSlide x2 -> valid slides in the style; 2nd call reads the prompt cache', async () => {
    const plan = readArtifact<LessonPlan>('e-plan.json')
    expect(plan, 'run e first').toBeTruthy()
    const profile = loadFixtureStyle()
    const ai = createLiveService()
    const indexes = [Math.min(2, plan!.slides.length - 1), Math.min(3, plan!.slides.length - 1)]
    const slides: Slide[] = []
    const before = usageSeen.length
    for (const index of indexes) {
      const { slide } = unwrap(
        await ai.writeSlide({ profile, brief: BRIEF, plan: plan!, index }),
        'writeSlide'
      )
      slides.push(slide)
    }
    saveArtifact('f-slides.json', slides)
    const calls = usageSeen.slice(before).filter((u) => u.task === 'writeSlide')
    saveArtifact('f-cache.json', calls)
    for (const slide of slides) {
      expect(slideSchema.safeParse(slide).success).toBe(true)
      const copy = structuredClone(slide)
      normaliseSlideInPlace(copy)
      expect(slideProblems(slide)).toEqual([])
      expect(slide.elements.length).toBeGreaterThanOrEqual(2)
      expect(slide.elements.some((e: Element) => e.type === 'text')).toBe(true)
    }
    expect(calls[1]?.usage.cacheReadTokens ?? 0).toBeGreaterThan(0)
  })
})
