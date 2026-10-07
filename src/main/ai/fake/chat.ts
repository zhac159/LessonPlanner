/**
 * Fake editor chat: understands a few phrases ("shorter", "delete slide N", "quiz") and edits the deck through the
 * caller's `applyOps` exactly like the real tool loop (so ChangeSet plumbing is exercised end to end).
 */
import { EMPTY_USAGE } from '@shared/ai/prices'
import type { AiService, ApiMessage, ChatSink, Usage } from '@shared/ai/types'
import type { ChangeSet, DeckOp, Element, Slide, TextElement } from '@shared/deck/types'
import { fail, ok, type Result } from '@shared/result'
import { INVALID_OPS } from '@shared/ai/errors'
import { fakePlaceAsset } from './chatAssets'

type ChatInput = Parameters<AiService['chatTurn']>[0]

interface OutlineSlide {
  id: string
  title?: string
}

/** Accepts `{ slides: [...] }` or a bare array of `{ id, ... }`. */
export function outlineSlides(outline: unknown): OutlineSlide[] {
  const list = Array.isArray(outline) ? outline : (outline as { slides?: unknown } | null)?.slides
  if (!Array.isArray(list)) return []
  return list.filter((s): s is OutlineSlide => typeof (s as OutlineSlide | null)?.id === 'string')
}

const words = (text: string, max: number): string => text.split(/\s+/).slice(0, max).join(' ')

interface Plan {
  summary: string
  ops: DeckOp[]
  reply: string
}

function shorten(input: ChatInput, slides: OutlineSlide[]): Plan | null {
  const selected = (input.selectedSlideJson as { id?: string } | undefined)?.id
  const target = selected ?? slides[0]?.id
  if (!target) return null
  const read = input.readSlides([target])
  const slide = (Array.isArray(read) ? read[0] : read) as Slide | undefined
  const body = slide?.elements.find((e): e is TextElement => e.type === 'text' && e.role === 'body')
  if (!slide || !body) return null
  // Really shorter: at most three paragraphs, one fewer than now (never none), and six words each.
  const keep = Math.min(3, Math.max(1, body.paragraphs.length - 1))
  const paragraphs = body.paragraphs.slice(0, keep).map((p) => ({
    ...p,
    runs: p.runs.map((run) => ({ ...run, text: words(run.text, 6) }))
  }))
  return {
    summary: 'Shortened the text',
    ops: [{ op: 'updateElement', slideId: slide.id, elementId: body.id, set: { paragraphs } }],
    reply: 'I’ve made that text shorter.'
  }
}

function deleteSlide(text: string, slides: OutlineSlide[]): Plan | null {
  const match = /delete slide (\d+)/i.exec(text)
  const target = match ? slides[Number(match[1]) - 1] : undefined
  if (!target) return null
  return {
    summary: `Deleted slide ${match?.[1]}`,
    ops: [{ op: 'deleteSlides', slideIds: [target.id] }],
    reply: `I’ve deleted slide ${match?.[1]}.`
  }
}

function addQuiz(slides: OutlineSlide[], id: string): Plan {
  const question = (text: string): Paragraph1 => ({ list: 'number', runs: [{ text }] })
  const elements: Element[] = [
    {
      id: `${id}-title`,
      type: 'text',
      role: 'title',
      x: 125,
      y: 140,
      w: 1700,
      h: 110,
      paragraphs: [{ runs: [{ text: 'Quick quiz' }] }]
    },
    {
      id: `${id}-qs`,
      type: 'text',
      role: 'body',
      x: 125,
      y: 290,
      w: 1700,
      h: 520,
      paragraphs: [
        question('What is the main idea of today’s lesson?'),
        question('Give one example.'),
        question('What is still unclear?')
      ]
    }
  ]
  const quiz: Slide = {
    id,
    kind: 'quiz',
    elements,
    notes: '5 minutes. Answers on the next slide.',
    source: { by: 'ai' }
  }
  return {
    summary: 'Added a quiz slide',
    ops: [{ op: 'insertSlides', afterSlideId: slides.at(-1)?.id ?? null, slides: [quiz] }],
    reply: 'I’ve added a three-question quiz at the end.'
  }
}

type Paragraph1 = TextElement['paragraphs'][number]

const HELP =
  'I’m a demo helper, so I only understand a few things: “make it shorter”, “delete slide 3” and “add a quiz”.'

export async function fakeChatTurn(
  input: ChatInput,
  sink: ChatSink,
  deps: { now: () => Date; newId: (prefix: string) => string }
): Promise<Result<{ usage: Usage; apiBlocks: unknown[] }>> {
  const slides = outlineSlides(input.deckOutline)
  const text = input.text
  const plan = /shorter|shorten/i.test(text)
    ? shorten(input, slides)
    : /delete slide \d+/i.test(text)
      ? deleteSlide(text, slides)
      : /quiz/i.test(text)
        ? addQuiz(slides, deps.newId('sld'))
        : null

  const placed = plan
    ? null
    : await fakePlaceAsset(
        input,
        sink,
        slides.map((s) => s.id)
      )
  let reply = placed ?? HELP
  if (plan) {
    sink.status('Making the changes', 'running')
    const outcome = await input.applyOps(plan.summary, plan.ops)
    if (!outcome.ok) {
      sink.status('Making the changes', 'error')
      return fail('invalid-input', INVALID_OPS)
    }
    sink.status('Making the changes', 'done')
    const changeSet: ChangeSet = {
      id: outcome.changeSetId,
      by: 'ai',
      summary: plan.summary,
      ops: plan.ops,
      at: deps.now().toISOString()
    }
    sink.changes(changeSet)
    reply = plan.reply
  }
  for (const word of reply.split(/(?<= )/)) sink.delta(word)

  const apiBlocks: ApiMessage[] = [
    { role: 'user', content: [{ type: 'text', text }] },
    { role: 'assistant', content: [{ type: 'text', text: reply }] }
  ]
  return ok({ usage: { ...EMPTY_USAGE }, apiBlocks })
}
