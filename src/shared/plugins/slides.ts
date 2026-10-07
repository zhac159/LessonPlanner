/**
 * Builds simple text slides (title + body) that sit on the style's own layouts, for plugins that
 * write slides locally from structured data (quiz, answers…). Pure.
 *
 * Decorations are copied from slides that already use the same layout (the lesson itself, then the
 * style's exemplars), because a profile stores only their component keys, not their geometry.
 */
import {
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  type Deck,
  type Element,
  type Paragraph,
  type Slide,
  type SlideKind,
  type TextElement
} from '../deck/types'
import type { LayoutRegion, LayoutTemplate, StyleProfile } from '../style/types'

export interface TextSlideSpec {
  id: string
  kind: SlideKind
  /** The small line above the title ("Quiz · Questions 1–3"). */
  kicker?: string
  title: string
  body: Paragraph[]
  notes?: string
  /** The plugin that makes the slide; without one the slide counts as the teacher's own. */
  pluginId?: string
}

const BOTTOM_MARGIN = 100

const FALLBACK = {
  title: { x: 125, y: 140, w: 1700, h: 110 },
  body: { x: 125, y: 290, w: 1700, h: 640 }
} as const

/**
 * The body box grows to the slide's right and bottom margins: the layout's other regions (picture, callout) are not
 * drawn on these slides, so their space is free for text.
 */
function grown(box: { x: number; y: number; w: number; h: number }): typeof box {
  return {
    x: box.x,
    y: box.y,
    w: Math.max(box.w, SLIDE_WIDTH - 2 * box.x),
    h: Math.max(box.h, SLIDE_HEIGHT - BOTTOM_MARGIN - box.y)
  }
}

/** The layout that serves `kind`, else the one for plain content, else the profile's first. */
export function pickLayout(
  style: Pick<StyleProfile, 'layouts'> | null,
  kind: SlideKind
): LayoutTemplate | undefined {
  const layouts = style?.layouts ?? []
  return (
    layouts.find((l) => l.usedFor.includes(kind)) ??
    layouts.find((l) => l.usedFor.includes('content')) ??
    layouts[0]
  )
}

const para = (text: string): Paragraph[] => [{ runs: [{ text }] }]

function textElement(
  id: string,
  role: TextElement['role'],
  box: { x: number; y: number; w: number; h: number },
  paragraphs: Paragraph[],
  styleRef?: string
): TextElement {
  return {
    id,
    type: 'text',
    role,
    name: role,
    ...box,
    ...(styleRef ? { styleRef } : {}),
    paragraphs
  }
}

const isRegion = (region: LayoutRegion, word: string): boolean =>
  `${region.name} ${region.styleRef ?? ''}`.toLowerCase().includes(word)

/** Locked decoration elements of the first slide that uses `layoutId`. */
function decorationsFor(
  layoutId: string,
  deck: Pick<Deck, 'slides'>,
  style: Pick<StyleProfile, 'exemplars'> | null
): Element[] {
  const candidates = [...deck.slides, ...(style?.exemplars.map((e) => e.digest) ?? [])]
  const donor = candidates.find((s) => s.layoutId === layoutId && s.elements.some((e) => e.locked))
  return donor?.elements.filter((e) => e.locked) ?? []
}

/** One slide: kicker (when the layout has one), title and body placed on the chosen layout's regions. */
export function buildTextSlide(
  spec: TextSlideSpec,
  style: StyleProfile | null,
  deck: Pick<Deck, 'slides'>
): Slide {
  const layout = pickLayout(style, spec.kind)
  const elements: Element[] = []
  if (layout) {
    decorationsFor(layout.id, deck, style).forEach((deco, i) =>
      elements.push({ ...structuredClone(deco), id: `${spec.id}-deco${i + 1}` })
    )
    const textRegions = layout.regions.filter((r) => r.elementType === 'text')
    const kicker = textRegions.find((r) => isRegion(r, 'kicker'))
    const title = textRegions.find((r) => isRegion(r, 'title'))
    const body = textRegions.find((r) => r !== kicker && r !== title && !isRegion(r, 'heading'))
    if (kicker && spec.kicker)
      elements.push(
        textElement(`${spec.id}-kicker`, 'kicker', kicker, para(spec.kicker), kicker.styleRef)
      )
    elements.push(
      textElement(
        `${spec.id}-title`,
        'title',
        title ?? FALLBACK.title,
        para(spec.title),
        title?.styleRef
      )
    )
    elements.push(
      textElement(
        `${spec.id}-body`,
        'body',
        body ? grown(body) : FALLBACK.body,
        spec.body,
        body?.styleRef
      )
    )
  } else {
    elements.push(textElement(`${spec.id}-title`, 'title', FALLBACK.title, para(spec.title)))
    elements.push(textElement(`${spec.id}-body`, 'body', FALLBACK.body, spec.body))
  }
  return {
    id: spec.id,
    kind: spec.kind,
    ...(layout ? { layoutId: layout.id } : {}),
    elements,
    ...(spec.notes ? { notes: spec.notes } : {}),
    source: spec.pluginId ? { by: 'plugin', pluginId: spec.pluginId } : { by: 'user' }
  }
}
