import { describe, expect, it, vi } from 'vitest'
import { sampleSlideWire, wireElement } from '../sampleDrafts'
import { checkedSlide, toSlide, type SlideWire } from './slide'

const box = { name: 'diagram', x: 100, y: 100, w: 600, h: 400, locked: false, styleRef: '' }
const withDiagram = (svg: string): SlideWire => ({
  ...sampleSlideWire(),
  elements: [wireElement({ type: 'diagram', ...box, svg, alt: 'A leaf cross-section' })]
})

describe('diagram safety', () => {
  it('keeps a clean SVG (sanitised)', () => {
    const [element] = toSlide(
      withDiagram('<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>'),
      's'
    ).elements
    expect(element).toMatchObject({ type: 'diagram', alt: 'A leaf cross-section' })
  })

  it('strips scripts from an otherwise usable SVG', () => {
    const [element] = toSlide(
      withDiagram(
        '<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="5" height="5"/></svg>'
      ),
      's'
    ).elements
    if (element.type !== 'diagram') throw new Error('expected a diagram')
    expect(element.svg).not.toContain('script')
  })

  it('turns an unusable drawing into a photo placeholder in the same box', () => {
    const [element] = toSlide(withDiagram('this is not svg'), 's').elements
    expect(element).toMatchObject({
      type: 'image',
      x: 100,
      y: 100,
      w: 600,
      h: 400,
      placeholder: { description: 'A leaf cross-section' }
    })
  })
})

describe('checkedSlide', () => {
  it('passes a good slide through the shared deck schema', () => {
    expect(checkedSlide(sampleSlideWire(), 'sld_ok')).toMatchObject({
      id: 'sld_ok',
      kind: 'content'
    })
  })

  it('fails with the generic error when the slide is not acceptable to the app', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = sampleSlideWire()
    bad.elements = [{ ...bad.elements[0], type: 'chips', items: [] } as never]
    expect(() => checkedSlide(bad, '')).toThrow()
    spy.mockRestore()
  })
})
