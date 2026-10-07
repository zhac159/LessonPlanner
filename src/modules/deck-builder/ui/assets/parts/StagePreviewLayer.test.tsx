import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StagePreviewLayer, tagAnchor } from './StagePreviewLayer'

const preview = (x: number, w: number) => ({
  box: { x, y: 270, w, h: 540, fit: 'contain' as const, density: 1, lowResolution: false },
  src: 'data:image/png;base64,AAAA',
  hideElementId: null,
  tag: 'leaf_cross_section · fitted to region 1'
})

describe('StagePreviewLayer', () => {
  it('draws the picture at the frame, in percentages of the slide, with the note', () => {
    const { container } = render(<StagePreviewLayer preview={preview(960, 480)} />)
    const box = container.querySelector('.stage-preview') as HTMLElement
    expect(box.style.left).toBe('50%')
    expect(box.style.top).toBe('25%')
    expect(box.style.width).toBe('25%')
    expect(box.style.height).toBe('50%')
    expect(box).toHaveAttribute('data-fit', 'contain')
    expect(box.querySelector('img')).toHaveStyle({ objectFit: 'contain' })
    expect(screen.getByRole('status')).toHaveTextContent('leaf_cross_section · fitted to region 1')
  })

  it('has no picture element while the source is not known', () => {
    const { container } = render(<StagePreviewLayer preview={{ ...preview(0, 400), src: null }} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps the note on the stage: pinned to the near edge for boxes at the sides', () => {
    expect(tagAnchor({ x: 1100, w: 700 })).toBe('end')
    expect(tagAnchor({ x: 50, w: 400 })).toBe('start')
    expect(tagAnchor({ x: 700, w: 520 })).toBe('centre')
  })
})
