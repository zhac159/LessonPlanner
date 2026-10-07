import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixtureStyle, makeSlide, makeText } from '@shared/deck/testing'
import type { CalloutElement, Element, ImageElement, Slide, TableElement } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { SlideView, type SlideViewProps } from './SlideView'

const spot = (over: Partial<ImageElement> = {}): ImageElement => ({
  id: 'spot1',
  type: 'image',
  x: 100,
  y: 100,
  w: 800,
  h: 600,
  fit: 'cover',
  alt: 'Leaf',
  placeholder: { description: 'A leaf in sunlight, close up', kind: 'photo' },
  ...over
})

const withElements = (...elements: Element[]): Slide => makeSlide('s', { elements })

function renderSlide(slide: Slide, props: Partial<SlideViewProps> = {}, style?: StyleProfile) {
  return render(<SlideView slide={slide} style={style ?? fixtureStyle()} scale={0.5} {...props} />)
}

/** Her profile: kicker without `uppercase`, orange one-off placeholder, white chips on white. */
function stonebridge(): StyleProfile {
  const style = fixtureStyle()
  const colour = (hex: string) => ({ hex, label: hex, usage: '' })
  Object.assign(style.tokens.colors, {
    background: colour('#F8FFAE'),
    text: colour('#000000'),
    accent: colour('#CC0000'),
    chipBg: colour('#FFFFFF'),
    chipText: colour('#FFFFFF'),
    placeholder: colour('#FFB800')
  })
  style.components.kicker = { description: 'Phase label', font: 'title', bold: true }
  style.components['callout.speech-bubble'] = {
    description: 'White wedge bubble',
    font: 'body',
    sizePt: 28,
    color: 'token:text',
    fill: 'token:chipBg'
  }
  return style
}

describe('SlideView: picture spots', () => {
  it('draws nothing for a spot by default (present mode, exports, the offscreen renderer)', () => {
    const { container } = renderSlide(withElements(spot()))
    expect(container.querySelector('[data-element-id="spot1"]')).toBeNull()
    expect(screen.queryByText('Picture spot')).toBeNull()
    expect(screen.queryByText('A leaf in sunlight, close up')).toBeNull()
  })

  it('never prints the description over the slide, whatever the mode', () => {
    const { container } = renderSlide(withElements(spot()), { spots: 'thumbnail' })
    expect(container.textContent).not.toContain('leaf in sunlight')
  })

  it('draws a faint dashed box without text in thumbnails', () => {
    const { container } = renderSlide(withElements(spot({ radius: 20 })), { spots: 'thumbnail' })
    const box = container.querySelector('.slide-spot--thumb') as HTMLElement
    expect(box).not.toBeNull()
    expect(box.textContent).toBe('')
    expect(box.style.borderRadius).toBe('20px')
    expect(container.querySelector('button')).toBeNull()
  })

  it('draws the editor spot: title, description and the "Fill this spot" pill', () => {
    const { container } = renderSlide(withElements(spot()), { spots: 'editor' })
    const frame = container.querySelector('[data-element-id="spot1"]') as HTMLElement
    expect(frame.style.width).toBe('800px')
    expect(within(frame).getByText('Picture spot')).toBeVisible()
    expect(within(frame).getByText('A leaf in sunlight, close up')).toBeVisible()
    expect(within(frame).getByText('Fill this spot')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Picture spot: A leaf in sunlight, close up' })).toBe(
      frame.querySelector('.slide-spot')
    )
    expect((frame.querySelector('.slide-spot') as HTMLElement).style.borderRadius).toBe('12px')
  })

  it('is a real button with the spec label when the editor can fill it', () => {
    const onFillSpot = vi.fn()
    renderSlide(withElements(spot()), { spots: 'editor', onFillSpot })
    const button = screen.getByRole('button', {
      name: 'Fill picture spot: A leaf in sunlight, close up'
    })
    fireEvent.click(button)
    expect(onFillSpot).toHaveBeenCalledWith('spot1')
  })

  it('an old placeholder with only a description is a spot too', () => {
    renderSlide(withElements(spot({ placeholder: { description: 'Photo: leaf' } })), {
      spots: 'editor'
    })
    expect(screen.getByText('Photo: leaf')).toBeVisible()
  })

  it('a filled spot draws its picture and keeps no spot chrome', () => {
    const { container } = renderSlide(withElements(spot({ assetId: 'ast_1' })), {
      spots: 'editor',
      resolveAsset: () => 'blob:leaf'
    })
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:leaf')
    expect(screen.queryByText('Picture spot')).toBeNull()
  })

  it('a missing picture shows its alt text in a neutral tint, not the orange profile token', () => {
    const broken = spot({ assetId: 'gone', alt: 'The school logo' })
    renderSlide(withElements(broken), { resolveAsset: () => null }, stonebridge())
    const box = screen.getByRole('img', { name: 'The school logo' })
    expect(box).toHaveTextContent('The school logo')
    expect(box.style.background).not.toBe('#FFB800')
    expect(box).toHaveStyle({ background: '#E5E7EB' })
  })
})

describe('SlideView: example-deck rendering defects', () => {
  const kicker = makeText('k', 'Input:', { role: 'kicker', x: 0, y: 0, w: 600, h: 80 })

  it('keeps her case for a kicker when the profile has a kicker component without uppercase', () => {
    renderSlide(withElements(kicker), {}, stonebridge())
    expect(screen.getByText('Input:')).not.toHaveStyle({ textTransform: 'uppercase' })
  })

  it('still capitals a kicker when the profile says so, or has no kicker component', () => {
    const style = stonebridge()
    style.components.kicker = { description: 'k', uppercase: true }
    renderSlide(withElements(kicker), {}, style)
    expect(screen.getByText('Input:')).toHaveStyle({ textTransform: 'uppercase' })
    const plain = renderSlide(withElements(kicker), {}, null as unknown as StyleProfile)
    expect(within(plain.container).getByText('Input:')).toHaveStyle({ textTransform: 'uppercase' })
  })

  it('table header text never equals the header fill (white chip text on a white chip)', () => {
    const table: TableElement = {
      id: 't',
      type: 'table',
      x: 0,
      y: 0,
      w: 800,
      h: 200,
      rows: [
        ['Singular', 'Plural'],
        ['mouse', 'mice']
      ],
      headerRow: true
    }
    renderSlide(withElements(table), {}, stonebridge())
    const header = screen.getByText('Singular')
    expect(header.style.background).toBe('#FFFFFF')
    expect(header.style.color).not.toBe('#FFFFFF')
    expect(header.style.color).toBe('#000000')
  })

  it('keeps a header colour that already reads', () => {
    const table: TableElement = {
      id: 't',
      type: 'table',
      x: 0,
      y: 0,
      w: 800,
      h: 200,
      rows: [['A']],
      headerRow: true
    }
    renderSlide(withElements(table))
    const header = screen.getByText('A')
    expect(header.style.color).not.toBe(header.style.background)
  })

  const bubble = (tail?: CalloutElement['tail']): CalloutElement => ({
    id: 'b',
    type: 'callout',
    variant: 'speech-bubble',
    x: 1260,
    y: 715,
    w: 660,
    h: 290,
    paragraphs: [{ runs: [{ text: 'What do you think the plural nouns are?' }] }],
    ...(tail ? { tail } : {})
  })

  it('draws a speech bubble as a white outlined wedge with a tail, text on top', () => {
    const { container } = renderSlide(withElements(bubble('bottom-left')), {}, stonebridge())
    const svg = container.querySelector('svg.slide-bubble') as SVGElement
    const path = svg.querySelector('path') as SVGPathElement
    expect(path.getAttribute('fill')).toBe('#FFFFFF')
    expect(path.getAttribute('stroke')).toBe('#000000')
    // the tail tip sits below the box (y beyond the 290 high body)
    const ys = [...(path.getAttribute('d') ?? '').matchAll(/ (-?\d+(?:\.\d+)?)(?=[ LQZ]|$)/g)].map(
      (m) => Number(m[1])
    )
    expect(Math.max(...ys)).toBeGreaterThan(290)
    expect(screen.getByText('What do you think the plural nouns are?')).toBeVisible()
    expect(container.querySelector('[data-variant="speech-bubble"]')).not.toBeNull()
  })

  it('moves the tail with the hint and leaves it out for "none"', () => {
    const top = renderSlide(withElements(bubble('top-right')), {}, stonebridge())
    const topPath = top.container.querySelector('svg.slide-bubble path')?.getAttribute('d') ?? ''
    expect(topPath).toMatch(/ -\d/) // a point above the box
    const none = renderSlide(withElements(bubble('none')), {}, stonebridge())
    const nonePath = none.container.querySelector('svg.slide-bubble path')?.getAttribute('d') ?? ''
    expect(nonePath).not.toMatch(/ -\d/)
    expect(nonePath).not.toBe(topPath)
  })

  it('gives other callouts no bubble outline', () => {
    const plain: CalloutElement = { ...bubble(), variant: 'mini-whiteboard' }
    const { container } = renderSlide(withElements(plain))
    expect(container.querySelector('svg.slide-bubble')).toBeNull()
  })
})

describe('SlideView: unresolved dates', () => {
  it('never prints an empty date field, but keeps a date she typed', () => {
    const slide = withElements(
      makeText('a', 'Monday {{date}}', { x: 0, y: 0, w: 800, h: 80 }),
      makeText('b', 'Monday 5th October 2026', { x: 0, y: 100, w: 800, h: 80 })
    )
    renderSlide(slide)
    expect(screen.getByText('Monday')).toBeVisible()
    expect(screen.getByText('Monday 5th October 2026')).toBeVisible()
    expect(screen.queryByText(/\{\{/)).toBeNull()
  })
})
