/**
 * LIVE checks g, h: the editor chat tool loop (real apply_changes against the real ChangeSet applier) and image
 * input with a circled region. Run: npm run test:live -- chat
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChatSink } from '@shared/ai/types'
import { applyChangeSet } from '@shared/deck/apply'
import { deckOutline } from '@shared/deck/outline'
import { elementText } from '@shared/deck/text'
import type { ChangeSet, Deck, DeckOp, Slide } from '@shared/deck/types'
import { loadFixtureDeck, loadFixtureStyle, makePng } from '../../export/testkit'
import { createLiveService, hasKey, saveArtifact, SKIP_MESSAGE, unwrap } from './harness'

const RENDER = join(process.cwd(), '.artifacts', 'render')
const png = async (name: string): Promise<Uint8Array> =>
  existsSync(join(RENDER, name))
    ? new Uint8Array(readFileSync(join(RENDER, name)))
    : new Uint8Array(await makePng(640, 360, '#CCDDEE'))

/** A stand-in for the deck-builder: a live deck, the real ChangeSet applier, and a recorder. */
function host(deck: Deck) {
  const state = {
    deck,
    changeSets: [] as ChangeSet[],
    attempts: [] as Array<{ ops: DeckOp[]; errors?: string[] }>,
    text: '',
    steps: [] as string[]
  }
  const sink: ChatSink = {
    delta: (t) => (state.text += t),
    status: (step, s) => state.steps.push(`${step}:${s}`),
    changes: (cs) => state.changeSets.push(cs)
  }
  const applyOps = async (summary: string, ops: DeckOp[]) => {
    const changeSet: ChangeSet = {
      id: `cs${state.attempts.length + 1}`,
      by: 'ai',
      summary,
      ops,
      at: new Date().toISOString()
    }
    const result = applyChangeSet(state.deck, changeSet)
    state.attempts.push({ ops, errors: result.ok ? undefined : result.errors })
    if (!result.ok) return { ok: false as const, errors: result.errors }
    state.deck = result.deck
    return { ok: true as const, changeSetId: changeSet.id }
  }
  const readSlides = (ids: string[]): Slide[] => state.deck.slides.filter((s) => ids.includes(s.id))
  return { state, sink, applyOps, readSlides }
}

const wordsIn = (slide: Slide): number =>
  slide.elements
    .map((e) => elementText(e))
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length

describe.skipIf(!hasKey())('live: editor chat', () => {
  if (!hasKey()) console.log(SKIP_MESSAGE)

  it('g) "make slide 2 shorter" runs the real tool loop and applies valid ops', async () => {
    const deck = loadFixtureDeck()
    const h = host(deck)
    const ai = createLiveService()
    const before = wordsIn(deck.slides[1])
    unwrap(
      await ai.chatTurn(
        {
          lessonId: 'les_x',
          messageId: 'm1',
          text: 'make slide 2 shorter',
          profile: loadFixtureStyle(),
          deckOutline: deckOutline(deck),
          history: [],
          effort: 'low',
          applyOps: h.applyOps,
          readSlides: h.readSlides,
          viewSlide: () => png('s2-plain.png')
        },
        h.sink
      ),
      'chatTurn'
    )
    saveArtifact('g-chat.json', {
      reply: h.state.text,
      steps: h.state.steps,
      attempts: h.state.attempts,
      changeSets: h.state.changeSets,
      wordsBefore: before,
      wordsAfter: wordsIn(h.state.deck.slides[1])
    })
    expect(h.state.changeSets.length).toBeGreaterThanOrEqual(1)
    expect(h.state.attempts.some((a) => !a.errors)).toBe(true)
    expect(wordsIn(h.state.deck.slides[1])).toBeLessThan(before)
    expect(h.state.deck.slides[0]).toEqual(deck.slides[0])
    expect(h.state.deck.slides[2]).toEqual(deck.slides[2])
    expect(h.state.text.length).toBeGreaterThan(5)
  })

  it('h) a circled region (annotated PNG + crop) reaches the model and the tool call targets it', async () => {
    const deck = loadFixtureDeck()
    const h = host(deck)
    const ai = createLiveService()
    unwrap(
      await ai.chatTurn(
        {
          lessonId: 'les_x',
          messageId: 'm2',
          text: 'make this picture a bit smaller',
          regions: [
            {
              n: 1,
              slideId: 's3',
              slideNumber: 3,
              annotatedPng: await png('s3-region.png'),
              cropPng: await png('s3-crop.png'),
              targetElementIds: ['s3-photo'],
              bbox: { x: 1024, y: 219, w: 884, h: 663 }
            }
          ],
          profile: loadFixtureStyle(),
          deckOutline: deckOutline(deck),
          selectedSlideJson: deck.slides[2],
          history: [],
          effort: 'low',
          applyOps: h.applyOps,
          readSlides: h.readSlides,
          viewSlide: () => png('s3-plain.png')
        },
        h.sink
      ),
      'chatTurn(region)'
    )
    saveArtifact('h-chat.json', {
      reply: h.state.text,
      steps: h.state.steps,
      attempts: h.state.attempts
    })
    expect(h.state.changeSets.length).toBeGreaterThanOrEqual(1)
    const touched = JSON.stringify(h.state.changeSets.flatMap((c) => c.ops))
    expect(touched).toContain('s3-photo')
    const photo = h.state.deck.slides[2].elements.find((e) => e.id === 's3-photo')!
    const was = deck.slides[2].elements.find((e) => e.id === 's3-photo')!
    expect(photo.w * photo.h).toBeLessThan(was.w * was.h)
  })
})
