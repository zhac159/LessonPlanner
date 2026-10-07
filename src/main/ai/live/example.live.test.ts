/**
 * LIVE check on the teacher's two REAL decks in example/ (exported PDFs, English / Stonebridge School):
 * analyseStyleFile x2 -> synthesiseProfile -> planLesson -> writeSlide x3, with a local spend cap.
 * Outputs (JSON, no key) go to .artifacts/example/; each stage is cached there so a re-run does not re-spend.
 * Delete the *.json files in .artifacts/example/ to force a fresh run.
 * Run: npx vitest run --config vitest.live.config.ts src/main/ai/live/example.live.test.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FileAnalysis, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { createLiveService, hasKey, redact, unwrap, usageSeen } from './harness'

const ROOT = resolve(process.cwd())
const EXAMPLE_DIR = join(ROOT, 'example')
const OUT = join(ROOT, '.artifacts', 'example')
/** The owner's budget for this experiment. */
const CAP_USD = 0.6

mkdirSync(OUT, { recursive: true })
const file = (name: string): string => join(OUT, name)
const save = (name: string, value: unknown): void =>
  writeFileSync(file(name), redact(JSON.stringify(value, null, 2)))
const load = <T>(name: string): T | undefined =>
  existsSync(file(name)) ? (JSON.parse(readFileSync(file(name), 'utf8')) as T) : undefined
const spent = (): number => usageSeen.reduce((sum, u) => sum + u.usd, 0)
const guard = (): void => {
  if (spent() >= CAP_USD) throw new Error(`local cap reached: $${spent().toFixed(3)}`)
}

const DECKS = [
  { id: 'L1', fileName: 'L1-Illustration and Meaning (Monday).pdf' },
  { id: 'L3', fileName: 'L3- Regular Irregular Plurals (Wednesday).pdf' }
]

const BRIEF: LessonBrief = {
  title: 'Spelling regular and irregular plurals',
  subject: 'English (Writing)',
  yearGroup: 'Y3',
  durationMin: 60,
  targetSlideCount: 8,
  objectives: [
    'To spell regular and irregular plural nouns correctly.',
    'To sort plural nouns by their spelling rule.',
    'To use plural nouns in sentences about the Stone Age.'
  ],
  context:
    'Follows a unit on the book "Stone Age Boy". Pupils met -s, -es and -ves plurals this week; irregular plurals such as children, feet and mice are new.'
}

describe.skipIf(!hasKey())('live: the teacher example decks', () => {
  it('1) analyseStyleFile on each real PDF', async () => {
    for (const deck of DECKS) {
      if (load(`analysis-${deck.id}.json`)) continue
      guard()
      const pdf = new Uint8Array(readFileSync(join(EXAMPLE_DIR, deck.fileName)))
      const ai = createLiveService()
      const { analysis } = unwrap(
        await ai.analyseStyleFile({ kind: 'pdf', fileName: deck.fileName, pdf }),
        `analyseStyleFile(${deck.id})`
      )
      save(`analysis-${deck.id}.json`, analysis)
    }
    expect(load('analysis-L1.json') && load('analysis-L3.json')).toBeTruthy()
  })

  it('2) synthesiseProfile from the two analyses', async () => {
    if (load('profile.json')) return
    guard()
    const analyses = DECKS.map((d) => load<FileAnalysis>(`analysis-${d.id}.json`)!)
    const ai = createLiveService()
    const { profile, testSlide } = unwrap(
      await ai.synthesiseProfile({ name: 'Stonebridge English', analyses }),
      'synthesiseProfile'
    )
    save('profile.json', { profile, testSlide })
    expect(profile.layouts.length).toBeGreaterThan(0)
  })

  it('3) planLesson + writeSlide x3 for one new lesson', async () => {
    const { profile } = load<{ profile: StyleProfile }>('profile.json')!
    const ai = createLiveService()
    let plan = load<LessonPlan>('plan.json')
    if (!plan) {
      guard()
      plan = unwrap(await ai.planLesson({ profile, brief: BRIEF }), 'planLesson').plan
      save('plan.json', plan)
    }
    const slides: Array<{ index: number; slide: Slide }> = load('slides.json') ?? []
    // a symbol-card slide (the plan's first symbol-cards-split layout) shows what the writer does for card grids
    const cards = plan.slides.findIndex((s) => s.layoutId === 'symbol-cards-split')
    if (slides.length > 0 && cards >= 0 && !slides.some((s) => s.index === cards)) {
      guard()
      const { slide } = unwrap(await ai.writeSlide({ profile, brief: BRIEF, plan, index: cards }), 'writeSlide(cards)')
      slides.push({ index: cards, slide })
      save('slides.json', slides)
    }
    if (slides.length === 0) {
      // objectives slide, the first slide that looks picture-led, and one task slide
      const pick = new Set<number>([0])
      const pic = plan.slides.findIndex(
        (s, i) => i > 0 && /picture|image|photo|card|symbol|illustrat/i.test(`${s.purpose} ${s.keyContent.join(' ')}`)
      )
      pick.add(pic > 0 ? pic : 2)
      pick.add(Math.min(plan.slides.length - 1, 4))
      for (const index of pick) {
        guard()
        const { slide } = unwrap(await ai.writeSlide({ profile, brief: BRIEF, plan, index }), `writeSlide(${index})`)
        slides.push({ index, slide })
      }
      save('slides.json', slides)
    }
    save('usage.json', {
      thisRunUsd: Number(spent().toFixed(4)),
      calls: usageSeen.map((u) => ({
        task: u.task,
        in: u.usage.inputTokens,
        out: u.usage.outputTokens,
        cacheR: u.usage.cacheReadTokens,
        cacheW: u.usage.cacheWriteTokens,
        usd: Number(u.usd.toFixed(4))
      }))
    })
    console.log(`[example] this run spent $${spent().toFixed(3)} over ${usageSeen.length} calls`)
    expect(slides.length).toBeGreaterThan(0)
  })
})
