/**
 * LIVE check of WP6 on the teacher's two REAL decks in example/: the whole learning pipeline of the styles service
 * (local picture extraction, exemplars, habits, defect fixes) with the earlier file analyses reused from
 * .artifacts/example/analysis-*.json (so only the two synthesis calls, one plan and three slides cost money), then
 * planLesson + writeSlide on the NEW profile. The earlier profile, plan and slides are kept in .artifacts/example/old/.
 * Outputs (no key) go to .artifacts/example/: profile.json, plan.json, slides.json (same shapes as the sibling
 * example.live.test.ts), report.json. Render them with `RENDER_CHECK_EXAMPLE=<repo>/.artifacts node scripts/render-check.mjs`.
 * Delete .artifacts/example/profile.json to re-run synthesis. Local cap: $0.45.
 * Run: npm run test:live -- src/main/ai/live/example.style.live.test.ts
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AiService, FileAnalysis, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { Slide } from '@shared/deck/types'
import { ok } from '@shared/result'
import type { StyleProfile } from '@shared/style/types'
import { fakePorts } from '../../services/styles/picturesTesting'
import { StylesService } from '../../services/styles/service'
import { createLiveService, hasKey, redact, unwrap, usageSeen } from './harness'

const ROOT = resolve(process.cwd())
const EXAMPLE_DIR = join(ROOT, 'example')
const OUT = join(ROOT, '.artifacts', 'example')
const OLD = join(OUT, 'old')
const CAP_USD = 0.45

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

/** The live AI, except that file analysis comes from the cache of the earlier run (no spend). */
function withCachedAnalyses(live: AiService): AiService {
  // spreading a service object would lose methods defined on a prototype: delegate by hand
  return {
    synthesiseProfile: async (input, opts) => {
      const result = await live.synthesiseProfile(input, opts)
      if (!result.ok) save('synth-failure.json', result)
      return result
    },
    applyStyleCorrection: (input, opts) => live.applyStyleCorrection(input, opts),
    analyseStyleFile: async (input) => {
      const deck = DECKS.find((d) => d.fileName === input.fileName)
      const cached = deck && load<FileAnalysis>(`old/analysis-${deck.id}.json`)
      return cached ? ok({ analysis: cached }) : live.analyseStyleFile(input)
    }
  } as AiService
}

describe.skipIf(!hasKey())('live: WP6 on the teacher example decks', () => {
  it('learns both decks end to end, locally for pictures and exemplars', async () => {
    mkdirSync(OLD, { recursive: true })
    for (const name of [
      'profile.json',
      'plan.json',
      'slides.json',
      'analysis-L1.json',
      'analysis-L3.json'
    ])
      if (!existsSync(join(OLD, name)) && existsSync(file(name)))
        copyFileSync(file(name), join(OLD, name))
    if (load('profile.json') && load('report.json')) return

    guard()
    const dir = mkdtempSync(join(tmpdir(), 'wp6-live-'))
    const fakes = fakePorts()
    const service = new StylesService({
      dir,
      ai: withCachedAnalyses(createLiveService()),
      ports: () => fakes.ports
    })
    try {
      const { styleId } = await service.create('Stonebridge English')
      await service.addFiles(
        styleId,
        DECKS.map((d) => join(EXAMPLE_DIR, d.fileName))
      )
      await service.whenIdle(styleId)
      const before = (await service.get(styleId)) as {
        ok: true
        style: import('@shared/contracts/style-library').StyleDraftView
      }
      const profile = (await service.getProfile(styleId))!
      // stop BEFORE anything is saved or spent when the synthesis was not applied (the style would only be the local vote)
      expect(profile.layouts.length, 'the synthesis was applied').toBeGreaterThan(0)
      // she keeps what was found: the school logo becomes an asset, so the "every slide" rule can be written
      const logo = fakes.review.batches[0]?.candidates.find((c) => c.kind === 'logo')
      if (logo)
        fakes.library.saved.set(logo.image.hash, { id: 'ast_school_logo', name: 'school_logo' })
      const after = (await service.get(styleId)) as typeof before
      const testSlide = after.style.profile?.testSlide ?? null
      // the earlier plan and slides belong to the earlier profile: the next step writes new ones
      rmSync(file('plan.json'), { force: true })
      rmSync(file('slides.json'), { force: true })
      save('profile.json', { profile: (await service.getProfile(styleId))!, testSlide })
      save('report.json', {
        progress: before.style.progress,
        assetsFoundBeforeReview: before.style.profile?.assetsFound ?? null,
        pictureHabitsBeforeReview: before.style.profile?.pictureHabits ?? [],
        pictureHabitsAfterKeepingTheLogo: after.style.profile?.pictureHabits ?? [],
        assetsFoundAfter: after.style.profile?.assetsFound
          ? {
              ...after.style.profile.assetsFound,
              preview: after.style.profile.assetsFound.preview.map((c) => c.name)
            }
          : null,
        candidates: (fakes.review.batches[0]?.candidates ?? []).map((c) => ({
          name: c.suggestedName,
          kind: c.kind,
          keep: c.keep,
          foundOn: c.foundOn
        })),
        colours: Object.fromEntries(
          Object.entries(profile.tokens.colors).map(([k, v]) => [k, `${v.hex} ${v.label}`])
        ),
        fonts: profile.tokens.fonts,
        fontsNeeded: profile.fontsNeeded ?? [],
        kicker: profile.components.kicker,
        exemplars: profile.exemplars.map((e) => ({
          page: e.page,
          kind: e.kind,
          why: e.why,
          elements: e.digest.elements.length
        })),
        habits: profile.habits,
        voice: profile.voice,
        layouts: profile.layouts.map((l) => ({
          id: l.id,
          usedFor: l.usedFor,
          regions: l.regions.map((r) => `${r.name}${r.optional ? '?' : ''}`)
        })),
        slideKinds: profile.slideTypes.map((s) => s.kind),
        placements: profile.pictures?.placements ?? []
      })
    } finally {
      await service.dispose()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('plans a lesson and writes three slides with the NEW profile', async () => {
    const { profile, testSlide } = load<{ profile: StyleProfile; testSlide: Slide | null }>(
      'profile.json'
    )!
    const ai = createLiveService()
    let plan = load<LessonPlan>('plan.json')
    const slides = load<Array<{ index: number; slide: Slide }>>('slides.json')
    if (plan && slides && slides.some((s) => s.index >= 0)) return
    guard()
    plan = unwrap(await ai.planLesson({ profile, brief: BRIEF }), 'planLesson').plan
    save('plan.json', plan)
    const pic = plan.slides.findIndex(
      (s, i) =>
        i > 0 &&
        /picture|image|photo|card|symbol|illustrat/i.test(`${s.purpose} ${s.keyContent.join(' ')}`)
    )
    const pick = [...new Set([0, pic > 0 ? pic : 2, Math.min(plan.slides.length - 1, 4)])]
    const written: Array<{ index: number; slide: Slide }> = testSlide
      ? [{ index: -1, slide: testSlide }]
      : []
    for (const index of pick) {
      guard()
      const { slide } = unwrap(
        await ai.writeSlide({ profile, brief: BRIEF, plan, index }),
        `writeSlide(${index})`
      )
      written.push({ index, slide })
    }
    save('slides.json', written)
    save('usage.json', {
      thisRunUsd: Number(spent().toFixed(4)),
      calls: usageSeen.map((u) => ({
        task: u.task,
        in: u.usage.inputTokens,
        out: u.usage.outputTokens,
        usd: Number(u.usd.toFixed(4))
      }))
    })
    console.log(
      `[example.style] this run spent $${spent().toFixed(3)} over ${usageSeen.length} calls`
    )
    expect(written.length).toBeGreaterThan(0)
  })
})
