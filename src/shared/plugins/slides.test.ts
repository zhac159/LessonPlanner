import { describe, expect, it } from 'vitest'
import { slideSchema } from '../deck/schema'
import { fixtureDeck, fixtureStyle, makeSlide } from '../deck/testing'
import type { Slide } from '../deck/types'
import { normaliseSelection, resolveSlides } from './slideRange'
import { describeSlides } from './slideText'
import { buildTextSlide, pickLayout } from './slides'
import { PluginError, definePlugin, orThrow } from './types'
import { fail, ok } from '../result'

const spec = {
  id: 's9',
  kind: 'content' as const,
  kicker: 'Quiz · Questions 1–3',
  title: 'Quick quiz',
  body: [{ runs: [{ text: '1. Question?' }] }],
  pluginId: 'quiz'
}

const textOf = (slide: Slide, role: string): string | undefined => {
  const el = slide.elements.find((e) => e.type === 'text' && e.role === role)
  return el?.type === 'text'
    ? el.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
    : undefined
}

describe('pickLayout', () => {
  const style = fixtureStyle()

  it('prefers a layout made for the kind, then plain content, then the first', () => {
    expect(pickLayout(style, 'title')?.id).toBe('title')
    expect(pickLayout(style, 'key-words')?.id).toBe('key-words')
    expect(pickLayout(style, 'quiz')?.id).toBe('content-text-left-image-right')
    expect(pickLayout({ layouts: [style.layouts[0]] }, 'quiz')?.id).toBe('title')
  })

  it('is undefined without a style or layouts', () => {
    expect(pickLayout(null, 'quiz')).toBeUndefined()
    expect(pickLayout({ layouts: [] }, 'quiz')).toBeUndefined()
  })
})

describe('buildTextSlide', () => {
  it('places kicker, title and body on the layout’s regions, with the layout id', () => {
    const slide = buildTextSlide(spec, fixtureStyle(), fixtureDeck())
    expect(slide).toMatchObject({
      id: 's9',
      kind: 'content',
      layoutId: 'content-text-left-image-right'
    })
    expect(textOf(slide, 'kicker')).toBe('Quiz · Questions 1–3')
    expect(textOf(slide, 'title')).toBe('Quick quiz')
    expect(textOf(slide, 'body')).toBe('1. Question?')
    const body = slide.elements.find((e) => e.type === 'text' && e.role === 'body')
    expect(body).toMatchObject({ x: 125, y: 345, w: 1670, h: 635, styleRef: 'body' })
    expect(slide.elements.map((e) => e.id)).toEqual(
      expect.arrayContaining(['s9-kicker', 's9-title', 's9-body'])
    )
    expect(slideSchema.safeParse(slide).success).toBe(true)
  })

  it('marks plugin slides as the plugin’s and others as the teacher’s', () => {
    expect(buildTextSlide(spec, null, { slides: [] }).source).toEqual({
      by: 'plugin',
      pluginId: 'quiz'
    })
    expect(buildTextSlide({ ...spec, pluginId: undefined }, null, { slides: [] }).source).toEqual({
      by: 'user'
    })
  })

  it('copies locked decorations from a slide using the same layout, with new ids', () => {
    const deck = fixtureDeck()
    const slide = buildTextSlide(spec, fixtureStyle(), deck)
    const locked = slide.elements.filter((e) => e.locked)
    expect(locked).toHaveLength(1)
    expect(locked[0]).toMatchObject({ id: 's9-deco1', styleRef: 'decoration.leftBand' })
    expect(deck.slides[1].elements.find((e) => e.locked)?.id).toBe('s2-band')
  })

  it('falls back to the style’s exemplars for decorations, and to none when nobody has them', () => {
    const style = fixtureStyle()
    const withoutDeck = buildTextSlide(spec, style, { slides: [] })
    expect(withoutDeck.elements.some((e) => e.locked)).toBe(
      style.exemplars.some(
        (x) => x.digest.layoutId === withoutDeck.layoutId && x.digest.elements.some((e) => e.locked)
      )
    )
    const bare = { ...style, exemplars: [] }
    expect(buildTextSlide(spec, bare, { slides: [] }).elements.some((e) => e.locked)).toBe(false)
  })

  it('leaves out the kicker when the layout has none or none is given', () => {
    const noKicker = buildTextSlide({ ...spec, kicker: undefined }, fixtureStyle(), fixtureDeck())
    expect(textOf(noKicker, 'kicker')).toBeUndefined()
    const style = fixtureStyle()
    style.layouts = style.layouts.map((l) => ({
      ...l,
      regions: l.regions.filter((r) => r.name !== 'kicker')
    }))
    expect(textOf(buildTextSlide(spec, style, fixtureDeck()), 'kicker')).toBeUndefined()
  })

  it('uses default geometry without a style, and for layouts with no body region', () => {
    const plain = buildTextSlide(spec, null, { slides: [] })
    expect(plain.layoutId).toBeUndefined()
    expect(plain.elements.map((e) => e.type === 'text' && e.role)).toEqual(['title', 'body'])
    const style = fixtureStyle()
    const titleOnly = { ...style, layouts: [style.layouts[0]] }
    const slide = buildTextSlide({ ...spec, kind: 'title' }, titleOnly, { slides: [] })
    expect(slide.elements.find((e) => e.type === 'text' && e.role === 'body')).toMatchObject({
      x: 125,
      y: 290
    })
  })

  it('keeps notes only when given', () => {
    expect(buildTextSlide(spec, null, { slides: [] })).not.toHaveProperty('notes')
    expect(buildTextSlide({ ...spec, notes: 'n' }, null, { slides: [] }).notes).toBe('n')
  })
})

describe('slide ranges', () => {
  const deck = { slides: ['a', 'b', 'c', 'd'].map((id) => makeSlide(id)) }
  const selection = { currentSlideId: 'b', selectedSlideIds: ['c', 'a'] }

  it('resolves all, selected and current in deck order', () => {
    expect(resolveSlides(deck, 'all', selection).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(resolveSlides(deck, 'selected', selection).map((s) => s.id)).toEqual(['a', 'c'])
    expect(resolveSlides(deck, 'current', selection).map((s) => s.id)).toEqual(['b'])
  })

  it('yields nothing for a stale selection', () => {
    expect(resolveSlides(deck, 'current', { currentSlideId: 'x', selectedSlideIds: [] })).toEqual(
      []
    )
  })

  it('normaliseSelection drops unknown ids, orders by deck and falls back to the current slide', () => {
    expect(
      normaliseSelection(deck, { currentSlideId: 'b', selectedSlideIds: ['d', 'zz', 'a'] })
    ).toEqual({
      currentSlideId: 'b',
      selectedSlideIds: ['a', 'd']
    })
    expect(normaliseSelection(deck, { currentSlideId: 'b', selectedSlideIds: [] })).toEqual({
      currentSlideId: 'b',
      selectedSlideIds: ['b']
    })
    expect(normaliseSelection(deck, { currentSlideId: 'gone', selectedSlideIds: ['zz'] })).toEqual({
      currentSlideId: 'a',
      selectedSlideIds: ['a']
    })
    expect(
      normaliseSelection({ slides: [] }, { currentSlideId: 'x', selectedSlideIds: [] })
    ).toEqual({
      currentSlideId: '',
      selectedSlideIds: []
    })
  })
})

describe('describeSlides', () => {
  it('writes one block per slide with position, id, kind, title and the other elements’ words', () => {
    const text = describeSlides(fixtureDeck().slides.slice(2))
    expect(text).toContain('Slide 1 (id s3, kind: objectives)')
    expect(text).toContain('- Describe where photosynthesis happens in a plant')
    expect(text).not.toMatch(/- .*\n.*kicker/i)
  })

  it('uses the given numbering and cuts very long text', () => {
    const slide = makeSlide('s7', {
      elements: [
        {
          id: 't',
          type: 'text',
          role: 'body',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          paragraphs: [{ runs: [{ text: 'word '.repeat(200) }] }]
        }
      ]
    })
    const text = describeSlides([slide], () => 7)
    expect(text.startsWith('Slide 7 (id s7, kind: content)')).toBe(true)
    expect(text.split('\n')[1].length).toBeLessThan(410)
    expect(text.endsWith('…')).toBe(true)
  })
})

describe('plugin helpers', () => {
  it('orThrow returns a success and throws PluginError with the failure otherwise', () => {
    expect(orThrow(ok({ n: 1 }))).toEqual({ ok: true, n: 1 })
    const failure = fail('no-key', 'Not connected')
    try {
      orThrow(failure)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError)
      expect((error as PluginError).failure).toBe(failure)
      expect((error as PluginError).message).toBe('Not connected')
    }
  })

  it('definePlugin returns the definition unchanged', () => {
    const definition = { id: 'x', run: async () => undefined }
    expect(definePlugin(definition)).toBe(definition)
  })
})
