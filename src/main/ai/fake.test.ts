import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AiService, ChatSink } from '@shared/ai/types'
import type { Deck, DeckOp, Slide } from '@shared/deck/types'
import { parseStyleProfile } from '@shared/style/schema'
import { aiErrorMessage } from '@shared/ai/errors'
import type { AiErrorCode } from '@shared/result'
import { createAiService } from './index'
import { createFakeAiService } from './fake'
import { fixtureDeck, fixtureProfile } from './fake/fixtures'
import { quizSchema } from '../../plugins/quiz/questions'

const profile = fixtureProfile()

function unwrap<T extends object>(result: ({ ok: true } & T) | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`)
  return result
}

describe('createFakeAiService: style learning', () => {
  const ai = createFakeAiService()

  it('analyses a file into a plausible FileAnalysis, the same way every time', async () => {
    const a = unwrap(
      await ai.analyseStyleFile({
        kind: 'pdf',
        fileName: 'Y8 Photosynthesis.pdf',
        pdf: new Uint8Array()
      })
    ).analysis
    const b = unwrap(
      await ai.analyseStyleFile({
        kind: 'pdf',
        fileName: 'Y8 Photosynthesis.pdf',
        pdf: new Uint8Array()
      })
    ).analysis
    expect(a).toEqual(b)
    expect(a.colors.length).toBeGreaterThan(3)
    expect(a.colors.find((c) => c.role === 'accent')?.hex).toBe(profile.tokens.colors.accent.hex)
    expect(a.layouts.length).toBe(profile.layouts.length)
    expect(a.voice.spelling).toBe('en-GB')
    expect(a.problems).toBeUndefined()
  })

  it('flags scanned files and fails on broken ones', async () => {
    const scanned = unwrap(
      await ai.analyseStyleFile({ kind: 'pptx', fileName: 'Scanned worksheet.pdf', digest: {} })
    ).analysis
    expect(scanned.problems?.[0]).toContain('scanned')
    expect(
      await ai.analyseStyleFile({ kind: 'pdf', fileName: 'broken.pdf', pdf: new Uint8Array() })
    ).toMatchObject({ ok: false, code: 'unknown' })
  })

  it('synthesises the fixture profile with streamed partials and a test slide', async () => {
    const partials: string[][] = []
    const { profile: result, testSlide } = unwrap(
      await ai.synthesiseProfile(
        { name: 'My style', analyses: [] },
        { onPartial: (p) => partials.push(Object.keys(p)) }
      )
    )
    expect(() => parseStyleProfile(result)).not.toThrow()
    expect(result).toMatchObject({ name: 'My style', version: 1, status: 'ready' })
    expect(partials).toEqual([['tokens'], ['layouts', 'slideTypes'], ['voice', 'habits']])
    expect(testSlide.elements.length).toBeGreaterThan(0)
  })

  it('refines an existing profile, keeping its id and sources', async () => {
    const existing = {
      ...profile,
      id: 'sty_mine',
      version: 4,
      sources: [
        {
          id: 's',
          fileName: 'a.pdf',
          kind: 'pdf' as const,
          pages: 1,
          status: 'learned' as const,
          addedAt: 'x'
        }
      ]
    }
    const next = unwrap(
      await ai.synthesiseProfile({ name: 'Mine', analyses: [], existing })
    ).profile
    expect(next).toMatchObject({ id: 'sty_mine', version: 5 })
    expect(next.sources).toHaveLength(1)
  })

  it('applies a correction as a new version with the correction recorded', async () => {
    const { profile: next, message } = unwrap(
      await ai.applyStyleCorrection({ profile, correction: 'Always use full stops' })
    )
    expect(next.version).toBe(profile.version + 1)
    expect(next.habits.at(-1)).toBe('Always use full stops')
    expect(next.corrections.at(-1)?.text).toBe('Always use full stops')
    expect(message).toMatch(/Done/)
  })
})

describe('createFakeAiService: lessons', () => {
  const ai = createFakeAiService()

  it('extracts objectives from lines starting with LO, plus title, subject and year', async () => {
    const { extracted } = unwrap(
      await ai.extractObjectives({
        text: 'Y9 Maths: fractions\nLO1: Add fractions\nlo2 - Compare fractions\nLO: Simplify\nsome notes'
      })
    )
    expect(extracted.objectives).toEqual(['Add fractions', 'Compare fractions', 'Simplify'])
    expect(extracted).toMatchObject({
      title: 'Y9 Maths: fractions',
      subject: 'Maths',
      yearGroup: 'Y9'
    })
  })

  it('gives the fixture lesson for a PDF and rejects nothing-to-read', async () => {
    const { extracted } = unwrap(await ai.extractObjectives({ pdf: new Uint8Array([1]) }))
    expect(extracted.objectives).toHaveLength(3)
    expect(await ai.extractObjectives({ text: ' ' })).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })

  it('plans slides from the objectives using the profile layouts', async () => {
    const { plan } = unwrap(
      await ai.planLesson({ profile, brief: { objectives: ['A', 'B', 'C'], title: 'Cells' } })
    )
    expect(plan.slides[0].kind).toBe('title')
    expect(plan.slides.at(-1)?.kind).toBe('exit-ticket')
    const known = new Set(profile.layouts.map((l) => l.id))
    expect(plan.slides.every((s) => known.has(s.layoutId))).toBe(true)
    expect(new Set(plan.slides.flatMap((s) => s.objectiveRefs))).toEqual(new Set([0, 1, 2]))
  })

  it('stays within two of a target slide count and reports progress', async () => {
    const progress = vi.fn()
    const { plan } = unwrap(
      await ai.planLesson(
        { profile, brief: { objectives: ['A', 'B', 'C', 'D', 'E', 'F'], targetSlideCount: 8 } },
        { onProgress: progress }
      )
    )
    expect(Math.abs(plan.slides.length - 8)).toBeLessThanOrEqual(2)
    expect(progress).toHaveBeenCalled()
  })

  it('plans without a profile (empty layout ids)', async () => {
    const { plan } = unwrap(await ai.planLesson({ profile: null, brief: { objectives: ['A'] } }))
    expect(plan.slides.every((s) => s.layoutId === '')).toBe(true)
  })

  it('writes slides on the layout regions, with locked decorations inside the slide', async () => {
    const { plan } = unwrap(
      await ai.planLesson({ profile, brief: { objectives: ['Describe it', 'Write it'] } })
    )
    const index = plan.slides.findIndex((s) => s.kind === 'content')
    const { slide } = unwrap(
      await ai.writeSlide({ profile, brief: { objectives: [] }, plan, index })
    )
    expect(slide.kind).toBe('content')
    expect(slide.elements.some((e) => e.locked)).toBe(true)
    expect(slide.elements.some((e) => e.type === 'text' && e.role === 'title')).toBe(true)
    for (const e of slide.elements) {
      expect(e.x + e.w).toBeLessThanOrEqual(1920)
      expect(e.y + e.h).toBeLessThanOrEqual(1080)
    }
    expect(new Set(slide.elements.map((e) => e.id)).size).toBe(slide.elements.length)
    expect(slide.notes).toBeTruthy()
  })

  it('writes a plain slide without a profile and rejects a bad index', async () => {
    const { plan } = unwrap(await ai.planLesson({ profile: null, brief: { objectives: ['A'] } }))
    const { slide } = unwrap(
      await ai.writeSlide({ profile: null, brief: { objectives: [] }, plan, index: 0 })
    )
    expect(slide.layoutId).toBeUndefined()
    expect(slide.elements).toHaveLength(2)
    expect(
      await ai.writeSlide({ profile: null, brief: { objectives: [] }, plan, index: 99 })
    ).toMatchObject({ ok: false })
  })
})

describe('createFakeAiService: chat', () => {
  const deck: Deck = fixtureDeck()
  const outline = { slides: deck.slides.map((s) => ({ id: s.id })) }

  function run(text: string, over: Partial<Parameters<AiService['chatTurn']>[0]> = {}) {
    const ai = createFakeAiService()
    const applied: Array<{ summary: string; ops: DeckOp[] }> = []
    const events: string[] = []
    const sink: ChatSink = {
      delta: (t) => events.push(`d:${t}`),
      status: (s, st) => events.push(`s:${s}:${st}`),
      changes: (c) => events.push(`c:${c.id}`)
    }
    const input = {
      lessonId: 'l',
      messageId: 'm',
      text,
      profile,
      deckOutline: outline,
      history: [],
      applyOps: async (summary: string, ops: DeckOp[]) => {
        applied.push({ summary, ops })
        return { ok: true as const, changeSetId: 'cs_fake' }
      },
      readSlides: (ids: string[]): Slide[] => deck.slides.filter((s) => ids.includes(s.id)),
      viewSlide: async () => new Uint8Array(),
      ...over
    }
    return { promise: ai.chatTurn(input, sink), applied, events }
  }

  it('"delete slide N" emits a deleteSlides ChangeSet for that slide', async () => {
    const { promise, applied, events } = run('Please delete slide 2')
    unwrap(await promise)
    expect(applied).toEqual([
      { summary: 'Deleted slide 2', ops: [{ op: 'deleteSlides', slideIds: ['s2'] }] }
    ])
    expect(events).toContain('c:cs_fake')
    expect(
      events
        .filter((e) => e.startsWith('d:'))
        .map((e) => e.slice(2))
        .join('')
    ).toBe('I’ve deleted slide 2.')
  })

  it('"shorter" trims the body text of the selected slide', async () => {
    const { promise, applied } = run('make it shorter', { selectedSlideJson: { id: 's2' } })
    unwrap(await promise)
    const op = applied[0].ops[0]
    expect(op).toMatchObject({ op: 'updateElement', slideId: 's2', elementId: 's2-qs' })
    if (op.op !== 'updateElement') throw new Error('x')
    const paragraphs = (op.set as { paragraphs: Array<{ runs: Array<{ text: string }> }> })
      .paragraphs
    expect(paragraphs.length).toBeLessThanOrEqual(3)
    expect(paragraphs.every((p) => p.runs.every((r) => r.text.split(' ').length <= 8))).toBe(true)
  })

  it('"quiz" adds a quiz slide after the last slide', async () => {
    const { promise, applied } = run('can you add a quiz?')
    unwrap(await promise)
    const op = applied[0].ops[0]
    expect(op).toMatchObject({ op: 'insertSlides', afterSlideId: 's3' })
    if (op.op !== 'insertSlides') throw new Error('x')
    expect(op.slides[0].kind).toBe('quiz')
  })

  it('answers other messages with help and changes nothing; returns replayable api messages', async () => {
    const { promise, applied } = run('hello')
    const result = unwrap(await promise)
    expect(applied).toEqual([])
    expect(result.apiBlocks).toHaveLength(2)
    expect(JSON.stringify(result.apiBlocks[1])).toContain('demo helper')
  })

  it('does nothing for "delete slide 99" and survives a rejected ChangeSet', async () => {
    const none = run('delete slide 99')
    unwrap(await none.promise)
    expect(none.applied).toEqual([])
    const rejected = run('delete slide 1', {
      applyOps: async () => ({ ok: false as const, errors: ['bad'] })
    })
    expect(await rejected.promise).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('accepts a bare array outline', async () => {
    const { promise, applied } = run('delete slide 1', { deckOutline: [{ id: 'a' }, { id: 'b' }] })
    unwrap(await promise)
    expect(applied[0].ops).toEqual([{ op: 'deleteSlides', slideIds: ['a'] }])
  })
})

describe('createFakeAiService: options', () => {
  it('structured answers the Quiz schema with ten usable questions', async () => {
    const ai = createFakeAiService()
    const data = unwrap(
      await ai.structured({ instructions: 'i', prompt: 'p', schema: quizSchema })
    ).data
    expect(data.questions).toHaveLength(10)
    expect(new Set(data.questions.map((q) => q.question)).size).toBe(10)
  })

  it('testConnection and structured work out of the box', async () => {
    const ai = createFakeAiService()
    expect(await ai.testConnection()).toMatchObject({ ok: true, model: 'claude-opus-5-5' })
    expect(
      unwrap(await ai.structured({ instructions: 'i', prompt: 'p', schema: z.object({}) })).data
    ).toEqual({})
    expect(
      await ai.structured({ instructions: 'i', prompt: 'p', schema: z.object({ n: z.number() }) })
    ).toMatchObject({ ok: false })
  })

  it('structured returns the configured reply (value or function), validated', async () => {
    const schema = z.object({ n: z.number() })
    const fixed = createFakeAiService({ structuredReply: { n: 3 } })
    expect(unwrap(await fixed.structured({ instructions: 'i', prompt: 'p', schema })).data).toEqual(
      { n: 3 }
    )
    const dynamic = createFakeAiService({
      structuredReply: (r: { prompt: string }) => ({ n: r.prompt.length })
    })
    expect(
      unwrap(await dynamic.structured({ instructions: 'i', prompt: 'four', schema })).data
    ).toEqual({ n: 4 })
    const wrong = createFakeAiService({ structuredReply: { n: 'x' } })
    expect(await wrong.structured({ instructions: 'i', prompt: 'p', schema })).toMatchObject({
      ok: false
    })
  })

  it.each<AiErrorCode>(['no-key', 'rate-limited', 'network', 'refused', 'no-credit'])(
    'failWith %s fails every method with the friendly message',
    async (code) => {
      const ai = createFakeAiService({ failWith: code })
      const expected = { ok: false, code, message: aiErrorMessage(code) }
      expect(await ai.testConnection()).toMatchObject(expected)
      expect(
        await ai.analyseStyleFile({ kind: 'pdf', fileName: 'a.pdf', pdf: new Uint8Array() })
      ).toMatchObject(expected)
      expect(await ai.planLesson({ profile: null, brief: { objectives: [] } })).toMatchObject(
        expected
      )
      expect(await ai.extractObjectives({ text: 'x' })).toMatchObject(expected)
    }
  )

  it('honours cancellation before and during a delay', async () => {
    const ai = createFakeAiService({ delayMs: 10_000 })
    const early = new AbortController()
    early.abort()
    expect(await ai.testConnection({ signal: early.signal })).toMatchObject({
      ok: false,
      code: 'cancelled'
    })
    const later = new AbortController()
    const pending = ai.planLesson(
      { profile: null, brief: { objectives: [] } },
      { signal: later.signal }
    )
    later.abort()
    expect(await pending).toMatchObject({ ok: false, code: 'cancelled' })
  })

  it('delays answers by delayMs', async () => {
    vi.useFakeTimers()
    const ai = createFakeAiService({ delayMs: 500 })
    const done = vi.fn()
    const pending = ai.testConnection().then(done)
    await vi.advanceTimersByTimeAsync(400)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    await pending
    expect(done).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('createAiService', () => {
  it('returns the fake when asked, never needing a key', async () => {
    const ai = createAiService({ fake: true })
    expect(await ai.testConnection()).toMatchObject({ ok: true })
    const delayed = createAiService({ fake: { failWith: 'network' } })
    expect(await delayed.testConnection()).toMatchObject({ ok: false, code: 'network' })
  })

  it('without a key the real service fails with no-key and never builds a client', async () => {
    const createClient = vi.fn()
    const ai = createAiService({ getApiKey: () => null, createClient })
    expect(await ai.testConnection()).toMatchObject({
      ok: false,
      code: 'no-key',
      message: aiErrorMessage('no-key')
    })
    expect(await ai.planLesson({ profile: null, brief: { objectives: [] } })).toMatchObject({
      ok: false,
      code: 'no-key'
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('with no deps at all it is a disconnected real service', async () => {
    expect(await createAiService().testConnection()).toMatchObject({ ok: false, code: 'no-key' })
  })
})
