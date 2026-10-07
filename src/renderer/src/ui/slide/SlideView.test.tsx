import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureDeck, fixtureStyle, makeSlide, makeText } from '@shared/deck/testing'
import type { Element, Slide } from '@shared/deck/types'
import type { FitMeasurer } from './fit'
import { SlideView, type SlideViewProps } from './SlideView'

const deck = fixtureDeck()
const style = fixtureStyle()
const [titleSlide, doNowSlide, objectivesSlide] = deck.slides

function renderSlide(slide: Slide, props: Partial<SlideViewProps> = {}) {
  return render(<SlideView slide={slide} style={style} scale={0.5} {...props} />)
}
const el = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-element-id="${id}"]`) as HTMLElement

describe('SlideView: structure', () => {
  it('draws the 1920x1080 canvas scaled by the scale prop', () => {
    const { container } = renderSlide(titleSlide, { scale: 0.25 })
    const canvas = container.querySelector('.slide-canvas') as HTMLElement
    expect(canvas.style.width).toBe('1920px')
    expect(canvas.style.height).toBe('1080px')
    expect(canvas.style.transform).toBe('scale(0.25)')
  })

  it('exposes the slide id and an optional accessible label', () => {
    renderSlide(titleSlide, { 'aria-label': 'Slide 1: title' })
    const group = screen.getByRole('group', { name: 'Slide 1: title' })
    expect(group).toHaveAttribute('data-slide-id', 's1')
  })

  it('positions elements absolutely in slide units, with rotation and z', () => {
    const slide = makeSlide('s', {
      elements: [makeText('t', 'Hi', { x: 10, y: 20, w: 300, h: 80, rotation: 15, z: 4 })]
    })
    const { container } = renderSlide(slide)
    const frame = el(container, 't')
    expect(frame.style.left).toBe('10px')
    expect(frame.style.top).toBe('20px')
    expect(frame.style.width).toBe('300px')
    expect(frame.style.height).toBe('80px')
    expect(frame.style.transform).toBe('rotate(15deg)')
    expect(frame.style.zIndex).toBe('4')
    expect(frame).toHaveAttribute('data-element-type', 'text')
  })

  it('paints elements in array order (DOM order)', () => {
    const slide = makeSlide('s', { elements: [makeText('a', 'first'), makeText('b', 'second')] })
    const { container } = renderSlide(slide)
    const ids = [...container.querySelectorAll('[data-element-id]')].map((n) =>
      n.getAttribute('data-element-id')
    )
    expect(ids).toEqual(['a', 'b'])
  })

  it('marks locked decorations', () => {
    const { container } = renderSlide(titleSlide)
    const band = el(container, 's1-band')
    expect(band).toHaveAttribute('data-locked', 'true')
    expect(band).toHaveClass('is-locked')
    expect(el(container, 's1-title')).not.toHaveAttribute('data-locked')
  })

  it('uses the profile background, or the slide background fill when set', () => {
    const { container, rerender } = renderSlide(titleSlide)
    expect((container.querySelector('.slide-canvas') as HTMLElement).style.background).toMatch(
      /#ffffff|rgb\(255, 255, 255\)/i
    )
    rerender(
      <SlideView
        slide={{ ...titleSlide, background: { color: 'token:highlight' } }}
        style={style}
        scale={0.5}
      />
    )
    expect((container.querySelector('.slide-canvas') as HTMLElement).style.background).toMatch(
      /#ffe36e|rgb\(255, 227, 110\)/i
    )
  })

  it('renders an empty slide', () => {
    const { container } = renderSlide(makeSlide('empty'))
    expect(container.querySelectorAll('[data-element-id]')).toHaveLength(0)
  })

  it('never uses app tokens in slide content (colours and fonts come from the profile)', () => {
    const { container } = renderSlide(objectivesSlide)
    expect(container.querySelectorAll('[style*="var(--"]')).toHaveLength(0)
    expect(container.innerHTML).not.toMatch(/Figtree|Bricolage/)
  })
})

describe('SlideView: text', () => {
  it('shows the fixture text with the profile font', () => {
    const { container } = renderSlide(objectivesSlide)
    expect(screen.getByText('Today I will…')).toBeInTheDocument()
    expect(screen.getByText('Describe where photosynthesis happens in a plant')).toBeInTheDocument()
    const title = el(container, 's3-title').querySelector('.slide-text') as HTMLElement
    expect(title.style.fontFamily).toContain('Lexend')
    expect(title.style.getPropertyValue('--base')).toBe('80px') // 40pt = 80 units
  })

  it('draws two-colour titles: the last words use the accent token from the profile', () => {
    renderSlide(objectivesSlide)
    const accented = screen.getByText('make food?')
    expect(accented).toHaveStyle({ color: '#0E7C7B' })
    expect(screen.getByText('What do plants need to')).not.toHaveStyle({ color: '#0E7C7B' })
  })

  it('resolves colour tokens through the profile (and the default palette without one)', () => {
    const { rerender } = renderSlide(titleSlide)
    expect(screen.getByText('make food?')).toHaveStyle({ color: '#0E7C7B' })
    rerender(<SlideView slide={titleSlide} style={null} scale={0.5} />)
    expect(screen.getByText('make food?')).toHaveStyle({ color: '#2563EB' })
  })

  it('applies role styling: kicker is uppercase and spaced; title uses the element font size', () => {
    const { container } = renderSlide(titleSlide)
    const kicker = el(container, 's1-kicker').querySelector('.slide-text') as HTMLElement
    expect(kicker.style.textTransform).toBe('uppercase')
    expect(kicker.style.letterSpacing).toBe('0.12em')
    expect(kicker.style.getPropertyValue('--base')).toBe('26px')
    const title = el(container, 's1-title').querySelector('.slide-text') as HTMLElement
    expect(title.style.getPropertyValue('--base')).toBe('120px') // fontSizePt: 60
  })

  it('renders bold, italic and underlined runs', () => {
    const slide = makeSlide('s', {
      elements: [
        makeText('t', '', {
          paragraphs: [
            {
              runs: [
                { text: 'b', bold: true },
                { text: 'i', italic: true },
                { text: 'u', underline: true }
              ]
            }
          ]
        })
      ]
    })
    renderSlide(slide)
    expect(screen.getByText('b')).toHaveStyle({ fontWeight: '700' })
    expect(screen.getByText('i')).toHaveStyle({ fontStyle: 'italic' })
    expect(screen.getByText('u')).toHaveStyle({ textDecoration: 'underline' })
  })

  it('shows numbered lists as an accessible list with 1., 2., 3.', () => {
    const { container } = renderSlide(doNowSlide)
    const list = within(el(container, 's2-qs')).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect([...list.querySelectorAll('.slide-para__marker')].map((m) => m.textContent)).toEqual([
      '1.',
      '2.',
      '3.'
    ])
  })

  it('shows tick-boxes in the accent colour for checkbox lists', () => {
    const { container } = renderSlide(objectivesSlide)
    const boxes = el(container, 's3-los').querySelectorAll<HTMLElement>('.slide-check')
    expect(boxes).toHaveLength(3)
    expect(boxes[0]).toHaveStyle({ borderColor: '#0E7C7B' })
  })

  it('shows bullets, nested by level', () => {
    const slide = makeSlide('s', {
      elements: [
        makeText('t', '', {
          paragraphs: [
            { list: 'bullet', runs: [{ text: 'one' }] },
            { list: 'bullet', level: 1, runs: [{ text: 'nested' }] }
          ]
        })
      ]
    })
    const { container } = renderSlide(slide)
    expect(
      [...container.querySelectorAll('.slide-para__marker')].map((m) => m.textContent)
    ).toEqual(['•', '◦'])
    expect(
      (screen.getByText('nested').closest('.slide-para') as HTMLElement).style.paddingLeft
    ).toBe('1.4em')
  })

  it('does not expose a list role when only some paragraphs are list items', () => {
    const slide = makeSlide('s', {
      elements: [
        makeText('t', '', {
          paragraphs: [{ runs: [{ text: 'intro' }] }, { list: 'bullet', runs: [{ text: 'item' }] }]
        })
      ]
    })
    renderSlide(slide)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it.each([
    ['left', 'top'],
    ['center', 'middle'],
    ['right', 'bottom']
  ] as const)('aligns text %s / %s', (align, valign) => {
    const slide = makeSlide('s', { elements: [makeText('t', 'Hi', { align, valign })] })
    const { container } = renderSlide(slide)
    const box = container.querySelector('.slide-text') as HTMLElement
    expect(box).toHaveClass(`slide-text--${valign}`)
    expect((container.querySelector('.slide-text__content') as HTMLElement).style.textAlign).toBe(
      align
    )
  })

  it('keeps empty paragraphs as blank lines', () => {
    const slide = makeSlide('s', {
      elements: [makeText('t', '', { paragraphs: [{ runs: [] }, { runs: [{ text: 'after' }] }] })]
    })
    const { container } = renderSlide(slide)
    expect(container.querySelectorAll('.slide-para')).toHaveLength(2)
  })
})

describe('SlideView: shrink to fit and the "doesn’t fit" badge', () => {
  const longText = (autoFit?: 'shrink' | 'none') =>
    makeSlide('s', { elements: [makeText('t', 'Lots of text', { autoFit })] })
  const fitVar = (c: HTMLElement) =>
    (c.querySelector('.slide-text') as HTMLElement).style.getPropertyValue('--fit')

  it('shrinks in 2% steps until the text fits', () => {
    const measurer = vi.fn<FitMeasurer>((_box, factor) => factor <= 0.8)
    const { container } = renderSlide(longText(), { measurer })
    expect(fitVar(container)).toBe('0.8')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('leaves text at full size when it fits', () => {
    const { container } = renderSlide(longText(), { measurer: () => true })
    expect(fitVar(container)).toBe('1')
  })

  it('stops at 60% and shows the badge only when badges are enabled', () => {
    const never = () => false
    const { container, unmount } = renderSlide(longText(), { measurer: never, showFitBadges: true })
    expect(fitVar(container)).toBe('0.6')
    expect(screen.getByRole('status')).toHaveTextContent('Doesn’t fit')
    unmount()
    const { container: plain } = renderSlide(longText(), { measurer: never })
    expect(fitVar(plain)).toBe('0.6')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('does not shrink with autoFit none, but still flags the overflow', () => {
    const { container } = renderSlide(longText('none'), {
      measurer: () => false,
      showFitBadges: true
    })
    expect(fitVar(container)).toBe('1')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('does no measuring at all for autoFit none without badges', () => {
    const measurer = vi.fn(() => false)
    const { container } = renderSlide(longText('none'), { measurer })
    expect(measurer).not.toHaveBeenCalled()
    expect(fitVar(container)).toBe('')
  })

  it('reports overflow changes by element id', () => {
    const onOverflowChange = vi.fn()
    const { rerender, unmount } = renderSlide(longText(), {
      measurer: () => false,
      onOverflowChange
    })
    expect(onOverflowChange).toHaveBeenCalledWith('t', true)
    rerender(
      <SlideView
        slide={longText()}
        style={style}
        scale={0.5}
        measurer={() => true}
        onOverflowChange={onOverflowChange}
      />
    )
    expect(onOverflowChange).toHaveBeenLastCalledWith('t', false)
    unmount()
  })

  it('re-fits when the text changes', () => {
    const measurer = vi.fn<FitMeasurer>(
      (box, factor) => ((box as HTMLElement).textContent ?? '').length < 20 || factor <= 0.7
    )
    const { container, rerender } = renderSlide(
      makeSlide('s', { elements: [makeText('t', 'short')] }),
      { measurer }
    )
    expect(fitVar(container)).toBe('1')
    const longer = makeSlide('s', {
      elements: [makeText('t', 'a much much longer paragraph of words')]
    })
    rerender(<SlideView slide={longer} style={style} scale={0.5} measurer={measurer} />)
    expect(fitVar(container)).toBe('0.7')
  })

  it('fits callout text too', () => {
    const slide = makeSlide('s', {
      elements: [
        {
          id: 'c',
          type: 'callout',
          variant: 'warning',
          x: 0,
          y: 0,
          w: 400,
          h: 100,
          paragraphs: [{ runs: [{ text: 'Careful' }] }]
        }
      ]
    })
    const { container } = renderSlide(slide, { measurer: (_b, f) => f <= 0.9 })
    expect(
      (container.querySelector('.slide-callout .slide-text') as HTMLElement).style.getPropertyValue(
        '--fit'
      )
    ).toBe('0.9')
  })
})

describe('SlideView: other elements', () => {
  it('draws chips as pills at the shared layout positions, in the chip colours', () => {
    const { container } = renderSlide(objectivesSlide)
    const chips = [...el(container, 's3-keywords').querySelectorAll<HTMLElement>('.slide-chip')]
    expect(chips.map((c) => c.textContent)).toEqual(['chlorophyll', 'glucose', 'endothermic'])
    expect(chips[0]).toHaveStyle({ color: '#0B5E5D', background: '#E3F2F1' })
    expect(chips[0].style.left).toBe('0px')
    expect(parseFloat(chips[1].style.left)).toBeGreaterThan(parseFloat(chips[0].style.left))
  })

  it('draws the callout with its fill, bold label and text', () => {
    const { container } = renderSlide(objectivesSlide)
    const callout = el(container, 's3-mwb').querySelector('.slide-callout') as HTMLElement
    expect(callout).toHaveStyle({ background: '#FFE36E' })
    expect(callout.style.borderRadius).toBe('19px')
    expect(callout.style.padding).toBe('31px 38px')
    expect(within(callout).getByText('Mini-whiteboards:')).toHaveStyle({ fontWeight: '700' })
  })

  it('shows a picture that cannot be shown as a tinted box with its caption and rounded corners', () => {
    const broken: Slide = makeSlide('s', {
      elements: [
        {
          id: 'i',
          type: 'image',
          x: 0,
          y: 0,
          w: 400,
          h: 300,
          fit: 'cover',
          alt: 'A leaf in sunlight',
          assetId: 'gone'
        }
      ]
    })
    const { container } = renderSlide(broken, { resolveAsset: () => null })
    const photo = screen.getByRole('img', { name: 'A leaf in sunlight' })
    expect(photo).toHaveTextContent('A leaf in sunlight')
    expect(photo).toHaveStyle({ background: '#E6EEEC', color: '#4A5A5F' })
    expect(photo.style.borderRadius).toBe('19px')
    expect(container.querySelector('img')).toBeNull()
  })

  it('shows the real picture when the asset resolves, with fit and radius', () => {
    const slide = makeSlide('s', {
      elements: [
        {
          id: 'i',
          type: 'image',
          x: 0,
          y: 0,
          w: 400,
          h: 300,
          fit: 'contain',
          alt: 'Leaf',
          assetId: 'ast_1',
          radius: 12
        }
      ]
    })
    const resolveAsset = vi.fn((id: string) => `file:///lesson/assets/${id}.png`)
    renderSlide(slide, { resolveAsset })
    const img = screen.getByRole('img', { name: 'Leaf' }) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img).toHaveAttribute('src', 'file:///lesson/assets/ast_1.png')
    expect(img.style.objectFit).toBe('contain')
    expect(img.style.borderRadius).toBe('12px')
    expect(resolveAsset).toHaveBeenCalledWith('ast_1')
  })

  it('falls back to the placeholder (alt text) when the asset is not available', () => {
    const slide = makeSlide('s', {
      elements: [
        {
          id: 'i',
          type: 'image',
          x: 0,
          y: 0,
          w: 400,
          h: 300,
          fit: 'cover',
          alt: 'A leaf',
          assetId: 'missing'
        }
      ]
    })
    renderSlide(slide, { resolveAsset: () => null })
    expect(screen.getByRole('img', { name: 'A leaf' })).toHaveTextContent('A leaf')
    renderSlide(slide) // no resolver at all
    expect(screen.getAllByRole('img', { name: 'A leaf' })).toHaveLength(2)
  })

  const diagram = (svg: string): Element => ({
    id: 'd',
    type: 'diagram',
    x: 0,
    y: 0,
    w: 600,
    h: 400,
    alt: 'A cell',
    svg
  })

  it('draws diagrams as inline SVG with an accessible name', () => {
    const svg = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0E7C7B"/></svg>'
    renderSlide(makeSlide('s', { elements: [diagram(svg)] }))
    const figure = screen.getByRole('img', { name: 'A cell' })
    expect(figure.querySelector('svg circle')).not.toBeNull()
    expect(figure.querySelector('svg')).toHaveAttribute('viewBox', '0 0 10 10')
  })

  it('sanitises diagrams again at render time (hostile SVG never reaches the DOM)', () => {
    const hostile =
      '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><foreignObject><div>x</div></foreignObject>' +
      '<rect width="5" height="5" onclick="alert(3)" fill="url(https://evil.test/x)"/></svg>'
    const { container } = renderSlide(makeSlide('s', { elements: [diagram(hostile)] }))
    const html = container.querySelector('.slide-diagram')!.innerHTML
    expect(html).toContain('<rect')
    expect(html).not.toMatch(/script|foreignObject|onload|onclick|evil/)
  })

  it('shows "Diagram unavailable" for SVG that cannot be made safe', () => {
    renderSlide(makeSlide('s', { elements: [diagram('<svg><rect/></svg>')] }))
    expect(screen.getByRole('img', { name: 'A cell' })).toHaveTextContent('Diagram unavailable')
  })

  it('scopes SVG ids so two diagrams on a page do not share markers', () => {
    const svg =
      '<svg viewBox="0 0 10 10"><defs><marker id="m" markerWidth="2" markerHeight="2"/></defs><line x1="0" y1="0" x2="9" y2="9" marker-end="url(#m)"/></svg>'
    const { container } = renderSlide(
      makeSlide('s', { elements: [diagram(svg), { ...diagram(svg), id: 'd2' }] })
    )
    const ids = [...container.querySelectorAll('marker')].map((m) => m.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(container.querySelector('line')!.getAttribute('marker-end')).toBe(`url(#${ids[0]})`)
  })

  it.each(['rect', 'roundRect', 'ellipse', 'line', 'arrow'] as const)(
    'draws a %s shape with resolved fill and stroke',
    (shape) => {
      const slide = makeSlide('s', {
        elements: [
          {
            id: 'sh',
            type: 'shape',
            shape,
            x: 0,
            y: 0,
            w: 200,
            h: 100,
            radius: 10,
            fill: { color: 'token:highlight', opacity: 0.5 },
            stroke: { color: 'token:accent', width: 4, dash: 'dash' }
          }
        ]
      })
      const { container } = renderSlide(slide)
      const svg = container.querySelector('svg.slide-shape') as SVGElement
      expect(svg).toHaveAttribute('viewBox', '0 0 200 100')
      const drawn = svg.querySelector('rect, ellipse, line') as SVGElement
      expect(drawn).not.toBeNull()
      expect(drawn.getAttribute('stroke')).toBe('#0E7C7B')
      if (shape === 'rect' || shape === 'roundRect' || shape === 'ellipse') {
        expect(drawn.getAttribute('fill')).toBe('#FFE36E')
        expect(drawn.getAttribute('fill-opacity')).toBe('0.5')
        expect(drawn.getAttribute('stroke-dasharray')).toBe('12 8')
      }
      if (shape === 'roundRect') expect(drawn.getAttribute('rx')).toBe('10')
      if (shape === 'arrow') expect(svg.querySelector('polygon')).not.toBeNull()
    }
  )

  it('draws a table with a header row and padded short rows', () => {
    const slide = makeSlide('s', {
      elements: [
        {
          id: 'tb',
          type: 'table',
          x: 0,
          y: 0,
          w: 600,
          h: 200,
          headerRow: true,
          colWidths: [200, 400],
          rows: [['Reactant', 'Product'], ['Water']]
        }
      ]
    })
    renderSlide(slide)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Reactant',
      'Product'
    ])
    expect(screen.getAllByRole('cell')).toHaveLength(2)
    expect(screen.getByRole('columnheader', { name: 'Reactant' })).toHaveStyle({
      background: '#E3F2F1'
    })
    expect(document.querySelectorAll('col')).toHaveLength(2)
  })

  it('draws a table without a header row as plain cells', () => {
    const slide = makeSlide('s', {
      elements: [
        {
          id: 'tb',
          type: 'table',
          x: 0,
          y: 0,
          w: 600,
          h: 200,
          headerRow: false,
          rows: [['a', 'b']]
        }
      ]
    })
    renderSlide(slide)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('cell')).toHaveLength(2)
  })

  it('renders the whole fixture deck without throwing, with and without a style', () => {
    for (const slide of deck.slides) {
      const first = renderSlide(slide)
      first.unmount()
      const second = renderSlide(slide, { style: null })
      second.unmount()
    }
  })
})

describe('SlideView: scaling to the container', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scales to the width of its container and follows resizes', () => {
    let width = 960
    const spy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(() => width)
    let notify: () => void = () => {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb
        }
        observe() {}
        disconnect() {}
      }
    )
    const { container } = render(<SlideView slide={titleSlide} style={style} />)
    const canvas = container.querySelector('.slide-canvas') as HTMLElement
    expect(canvas.style.transform).toBe('scale(0.5)')
    width = 480
    act(() => notify())
    expect(canvas.style.transform).toBe('scale(0.25)')
    spy.mockRestore()
  })

  it('keeps the last scale when the container has no width yet', () => {
    const { container } = render(<SlideView slide={titleSlide} style={style} />)
    expect((container.querySelector('.slide-canvas') as HTMLElement).style.transform).toBe(
      'scale(0.25)'
    )
  })
})
