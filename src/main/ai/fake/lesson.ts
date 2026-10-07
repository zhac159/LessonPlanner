/** Fake lesson generation: objectives parsing, a plan from the objectives, and slides built on the profile layouts. */
import type { ExtractedObjectives, LessonBrief, LessonPlan } from '@shared/ai/types'
import type { Element, Paragraph, Slide, SlideKind } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { layoutFor } from '../calls/planRules'
import { fixtureDeck } from './fixtures'

const SUBJECTS = ['Science', 'Maths', 'English', 'History', 'Geography', 'Computing', 'Art']
const LO_LINE = /^\s*LO\s*\d*\s*[:.)-]?\s*(.+)$/i

/** Lines starting with "LO" are objectives; the first other line is the title. No text gives the fixture lesson. */
export function fakeObjectives(text?: string): ExtractedObjectives {
  if (!text?.trim()) {
    const { title, meta } = fixtureDeck()
    return {
      title,
      subject: meta.subject,
      yearGroup: 'Y8',
      objectives: meta.objectives,
      context: meta.context
    }
  }
  const lines = text.split(/\r?\n/)
  const objectives = lines.flatMap((line) => LO_LINE.exec(line)?.[1].trim() ?? [])
  const title =
    lines.find((line) => line.trim() && !LO_LINE.test(line))?.trim() ?? 'Untitled lesson'
  const year = /\bY(?:ear)?\s*(\d{1,2})\b/i.exec(text)
  const subject = SUBJECTS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(text))
  return {
    title,
    ...(subject ? { subject } : {}),
    ...(year ? { yearGroup: `Y${year[1]}` } : {}),
    objectives
  }
}

const words = (text: string, max: number): string => text.split(/\s+/).slice(0, max).join(' ')

/** Title, Do Now, objectives, a content slide per objective (+ a question after every second), check, exit ticket. */
export function fakePlan(profile: StyleProfile | null, brief: LessonBrief): LessonPlan {
  const objectives = brief.objectives.length ? brief.objectives : ['The topic']
  const slide = (
    kind: SlideKind,
    purpose: string,
    refs: number[],
    keyContent: string[],
    minutes?: number
  ) => ({
    kind,
    layoutId: layoutFor(kind, profile),
    purpose,
    keyContent,
    ...(minutes ? { minutes } : {}),
    objectiveRefs: refs
  })
  const all = objectives.map((_, i) => i)
  const middle = objectives.flatMap((objective, i) => [
    slide(
      'content',
      `Teach: ${objective}`,
      [i],
      [objective, `Key idea ${i + 1}`, `Worked example ${i + 1}`],
      10
    ),
    ...(i % 2 === 1
      ? [
          slide(
            'question',
            `Check understanding of: ${objective}`,
            [i],
            ['Mini-whiteboard question'],
            5
          )
        ]
      : [])
  ])
  const fixed = 5
  const target = brief.targetSlideCount
  const room = target ? Math.max(1, target - fixed) : middle.length
  const slides = [
    slide('title', 'Title slide', [], [brief.title ?? 'Lesson']),
    slide(
      'do-now',
      'Retrieval starter on last lesson',
      [],
      ['Question 1', 'Question 2', 'Question 3'],
      5
    ),
    slide('objectives', 'Share the learning objectives', all, objectives),
    ...middle.slice(0, room),
    slide('check', 'Check what they have learned', all, ['Three quick questions'], 5),
    slide(
      'exit-ticket',
      'Exit ticket',
      all,
      ['One thing I learned', 'One thing I am unsure about'],
      3
    )
  ]
  return {
    title: brief.title ?? 'New lesson',
    summary: `A ${slides.length}-slide lesson covering ${objectives.length} objective${objectives.length === 1 ? '' : 's'}.`,
    slides
  }
}

const bullets = (items: string[]): Paragraph[] =>
  items.slice(0, 4).map((text) => ({ list: 'bullet', runs: [{ text: words(text, 12) }] }))

function regionElement(
  region: StyleProfile['layouts'][number]['regions'][number],
  planned: LessonPlan['slides'][number],
  id: string
): Element | null {
  const box = {
    id,
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    name: region.name,
    ...(region.styleRef ? { styleRef: region.styleRef } : {})
  }
  const lower = region.name.toLowerCase()
  switch (region.elementType) {
    case 'text': {
      if (lower.includes('kicker')) {
        const minutes = planned.minutes ? ` · ${planned.minutes} minutes` : ''
        return {
          ...box,
          type: 'text',
          role: 'kicker',
          paragraphs: [{ runs: [{ text: `${planned.kind.replace('-', ' ')}${minutes}` }] }]
        }
      }
      if (lower.includes('title')) {
        const title = words(planned.purpose, 8).split(' ')
        const last = title.pop() ?? ''
        return {
          ...box,
          type: 'text',
          role: 'title',
          paragraphs: [
            {
              runs: [
                { text: title.length ? `${title.join(' ')} ` : '' },
                { text: last, color: 'token:accent' }
              ]
            }
          ]
        }
      }
      if (lower.includes('heading'))
        return {
          ...box,
          type: 'text',
          role: 'heading',
          paragraphs: [{ runs: [{ text: 'Today I will…' }] }]
        }
      return { ...box, type: 'text', role: 'body', paragraphs: bullets(planned.keyContent) }
    }
    case 'chips':
      return {
        ...box,
        type: 'chips',
        items: planned.keyContent.slice(0, 4).map((c) => words(c, 2))
      }
    case 'callout':
      return {
        ...box,
        type: 'callout',
        variant: 'mini-whiteboard',
        label: 'Mini-whiteboard',
        paragraphs: [{ runs: [{ text: `Show me: ${words(planned.purpose, 8)}` }] }]
      }
    case 'image':
      return {
        ...box,
        type: 'image',
        fit: 'cover',
        alt: planned.purpose,
        placeholder: { description: `Photo to illustrate: ${planned.purpose}` }
      }
    default:
      return null
  }
}

/** One slide for plan entry `index`, placed on the entry's layout (or a plain title + body without one). */
export function fakeSlide(
  profile: StyleProfile | null,
  plan: LessonPlan,
  index: number,
  id: string
): Slide {
  const planned = plan.slides[index]
  const layout = profile?.layouts.find((l) => l.id === planned.layoutId)
  const decorations: Element[] = (layout?.decorations ?? []).map((key, i) => ({
    id: `${id}-decoration${i + 1}`,
    type: 'shape',
    shape: 'rect',
    x: 0,
    y: 0,
    w: 27,
    h: 1080,
    locked: true,
    styleRef: key,
    fill: { color: 'token:accent' }
  }))
  const regions: Element[] = layout
    ? layout.regions.flatMap(
        (region) => regionElement(region, planned, `${id}-${region.name}`) ?? []
      )
    : [
        {
          id: `${id}-title`,
          type: 'text',
          role: 'title',
          x: 125,
          y: 140,
          w: 1700,
          h: 110,
          paragraphs: [{ runs: [{ text: words(planned.purpose, 8) }] }]
        },
        {
          id: `${id}-body`,
          type: 'text',
          role: 'body',
          x: 125,
          y: 290,
          w: 1700,
          h: 520,
          paragraphs: bullets(planned.keyContent)
        }
      ]
  return {
    id,
    kind: planned.kind,
    ...(layout ? { layoutId: layout.id } : {}),
    elements: [...decorations, ...regions],
    notes: `${planned.minutes ?? 5} minutes. ${planned.purpose}. Watch for the usual mix-ups and take two answers before revealing.`,
    source: { by: 'ai' }
  }
}
