/** The defects found on the teacher's example decks (agents/ASSETS.md §5.7), fixed in code and proven through the service. */
import { afterEach, describe, expect, it } from 'vitest'
import type { Slide } from '@shared/deck/types'
import { ok } from '@shared/result'
import { createDraftProfile } from '@shared/style/draft'
import { makeAnalysis } from '@shared/style/testing'
import type { StyleProfile } from '@shared/style/types'
import { DATE_SLOT_RULE } from './defects'
import { createHarness, type Harness } from './testing'

let h: Harness
afterEach(() => h?.cleanup())

const WRITING = 'Input:'

/** What the model returned on the example decks: leaked colours, a copied date, a foreign test slide. */
function modelProfile(): StyleProfile {
  const profile = createDraftProfile('model', 'Stonebridge English', '2026-10-07T00:00:00Z')
  profile.tokens.colors.muted = {
    hex: '#00A651',
    label: 'Green',
    usage: 'A label seen in one deck'
  }
  profile.tokens.colors.placeholder = {
    hex: '#FFB800',
    label: 'Yellow-orange card',
    usage: 'Verb symbol cards on one slide'
  }
  profile.tokens.fonts.title = {
    ...profile.tokens.fonts.title,
    family: 'Comic Sans MS',
    available: false
  }
  profile.components.kicker = { description: 'Phase label', uppercase: true }
  profile.habits = ['Monday 5th October 2026 - LO and steps on the first slide', 'Red header band']
  profile.voice.phrases = ['Input:', 'Task:', 'Wednesday 7th October 2026']
  profile.layouts = [
    {
      id: 'objectives',
      name: 'Objectives',
      usedFor: ['objectives'],
      regions: [{ name: 'date', elementType: 'text', x: 0, y: 0, w: 100, h: 40 }],
      decorations: []
    }
  ]
  profile.slideTypes = [
    { kind: 'objectives', name: 'Objectives', frequency: 'always', description: 'LO' },
    { kind: 'question', name: 'Input', frequency: 'often', description: 'Questions' }
  ]
  return profile
}

const foreignSlide = (): Slide => ({
  id: 'sld_test',
  kind: 'content',
  elements: [
    {
      id: 'e1',
      type: 'text',
      role: 'heading',
      x: 0,
      y: 0,
      w: 800,
      h: 100,
      paragraphs: [{ runs: [{ text: 'Photosynthesis for Year 8' }] }]
    }
  ]
})

async function learnWith(
  analysis = makeAnalysis({ exemplarCandidates: [{ page: 1, why: 'Her Do Now format' }] }),
  over: Parameters<typeof createHarness>[0] = {}
) {
  h = createHarness(over)
  h.stub.results.set('a.pdf', ok({ analysis }))
  h.stub.synthResult = () => ok({ profile: modelProfile(), testSlide: foreignSlide() })
  const { styleId } = await h.service.create()
  await h.service.addFiles(styleId, [h.pdf('a.pdf', `${WRITING} Monday 5th October 2026`)])
  await h.service.whenIdle(styleId)
  const profile = (await h.service.getProfile(styleId))!
  const view = await h.service.get(styleId)
  return { styleId, profile, view: view.ok ? view.style : null }
}

describe('example-deck defects', () => {
  it('3: structural colours stay neutral; one-off colours move to named extras', async () => {
    const { profile } = await learnWith()
    const { colors } = profile.tokens
    expect(colors.muted?.hex).toMatch(/^#([0-9A-F]{2})\1\1$/) // a grey
    expect(colors.placeholder?.hex).not.toBe('#FFB800')
    expect(colors.extra_green?.hex).toBe('#00A651')
    expect(colors.extra_yellow_orange_card?.hex).toBe('#FFB800')
  })

  it('4: no copied date survives in habits, phrases or exemplars; the date is an optional slot', async () => {
    const { profile } = await learnWith()
    const text = JSON.stringify([profile.habits, profile.voice, profile.exemplars])
    expect(text).not.toMatch(/October|2026|Monday|Wednesday/)
    expect(profile.habits).toContain('Red header band')
    expect(profile.layouts[0].regions[0]).toMatchObject({ name: 'date', optional: true })
    expect(profile.voice.rules).toContain(DATE_SLOT_RULE)
  })

  it('5: a kicker she writes in normal case gets an explicit uppercase:false', async () => {
    const { profile } = await learnWith()
    expect(profile.components.kicker.uppercase).toBe(false)
  })

  it('5: and stays uppercase when her kicker text is in capitals', async () => {
    h = createHarness()
    h.stub.synthResult = () => ok({ profile: modelProfile(), testSlide: foreignSlide() })
    const profile = modelProfile()
    profile.voice.phrases = ['INPUT:', 'TASK:']
    h.stub.synthResult = () => ok({ profile, testSlide: foreignSlide() })
    const { styleId } = await h.service.create()
    await h.service.addFiles(styleId, [h.pdf('a.pdf')])
    await h.service.whenIdle(styleId)
    expect((await h.service.getProfile(styleId))?.components.kicker.uppercase).toBe(true)
  })

  it('6: a test slide about something she never teaches is replaced by the neutral template', async () => {
    const { view } = await learnWith()
    expect(view?.profile?.testSlide).toBeNull()
  })

  it('7: exemplars are digests of the pages the analysis named', async () => {
    const { profile } = await learnWith()
    expect(profile.exemplars).toHaveLength(1)
    const [exemplar] = profile.exemplars
    expect(exemplar).toMatchObject({ page: 1, why: 'Her Do Now format' })
    const words = JSON.stringify(exemplar.digest.elements)
    expect(words).toContain(WRITING)
    expect(words).not.toMatch(/October/)
  })

  it('fonts: an installed font counts as available on this PC, and another PC would need it', async () => {
    const { profile } = await learnWith(undefined, {
      installedFonts: async () => new Set(['comic sans ms'])
    })
    expect(profile.tokens.fonts.title).toMatchObject({ family: 'Comic Sans MS', available: true })
    expect(profile.fontsNeeded).toEqual(['Comic Sans MS'])
  })

  it('fonts: not installed here means not available, still listed as needed', async () => {
    const { profile } = await learnWith(undefined, {
      installedFonts: async () => new Set(['arial'])
    })
    expect(profile.tokens.fonts.title.available).toBe(false)
    expect(profile.fontsNeeded).toEqual(['Comic Sans MS'])
  })

  it('source plan: the scheme’s plan page is not a slide kind, an exemplar or a style fact', async () => {
    const analysis = makeAnalysis({
      slideKinds: [
        { page: 1, kind: 'custom', title: 'Writing Root session plan (source reference sheet)' },
        { page: 2, kind: 'objectives', title: 'Monday 5th October 2026 - LO: To infer meaning' }
      ],
      exemplarCandidates: [
        { page: 1, why: 'The plan' },
        { page: 2, why: 'Her objectives slide' }
      ],
      problems: ['Page 1 is a Writing Root published session plan, not one of her own slides.']
    })
    const { styleId } = await learnWith(analysis)
    const sent = h.stub.synthAnalyses[0][0]
    expect(sent.slideKinds).toEqual([
      { page: 2, kind: 'objectives', title: 'LO: To infer meaning' }
    ])
    expect(sent.exemplarCandidates.map((e) => e.page)).toEqual([2])
    const stored = await h.service.getProfile(styleId)
    expect(stored?.exemplars.map((e) => e.page)).toEqual([2])
  })
})
