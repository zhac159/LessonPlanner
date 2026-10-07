import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RenderJob } from '@shared/annotate/renderJob'
import { RegionLayer } from './RegionLayer'

type Layer = Pick<RenderJob, 'regions' | 'strokes' | 'viewport' | 'scale'>

const layer = (over: Partial<Layer> = {}): Layer => ({
  viewport: { x: 0, y: 0, w: 1920, h: 1080 },
  scale: 0.5,
  regions: [
    {
      n: 1,
      path: [
        [1000, 400],
        [1500, 400],
        [1500, 800],
        [1000, 800]
      ],
      bbox: { x: 1000, y: 400, w: 500, h: 400 }
    },
    {
      n: 2,
      path: [
        [100, 100],
        [300, 100],
        [200, 300]
      ],
      bbox: { x: 100, y: 100, w: 200, h: 200 }
    }
  ],
  strokes: [],
  ...over
})

describe('RegionLayer', () => {
  it('draws nothing when there is nothing to draw', () => {
    const { container } = render(<RegionLayer job={layer({ regions: [], strokes: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('draws one closed loop per region, in image pixels', () => {
    const { container } = render(<RegionLayer job={layer()} />)
    const loops = container.querySelectorAll('path[data-region]')
    expect(loops).toHaveLength(2)
    expect(loops[0].getAttribute('d')).toBe('M 500 200 L 750 200 L 750 400 L 500 400 Z')
    expect(container.querySelector('svg')).toHaveAttribute('width', '960')
    expect(container.querySelector('svg')).toHaveAttribute('height', '540')
  })

  it('numbers each loop in a label', () => {
    const { container } = render(<RegionLayer job={layer()} />)
    expect(container.querySelector('[data-region-label="1"]')).toHaveTextContent('1')
    expect(container.querySelector('[data-region-label="2"]')).toHaveTextContent('2')
  })

  it('pins the label above the top-left of the loop, kept inside the image', () => {
    const { container } = render(<RegionLayer job={layer()} />)
    const first = container.querySelector('[data-region-label="1"]') as HTMLElement
    expect(first.style.top).toBe('160px')
    const second = container.querySelector('[data-region-label="2"]') as HTMLElement
    expect(second.style.top).toBe('10px')
    expect(second.style.left).toBe('31px')
  })

  it('draws Draw-tool strokes as open paths without a label', () => {
    const { container } = render(
      <RegionLayer
        job={layer({
          regions: [],
          strokes: [
            [
              [0, 0],
              [200, 100]
            ]
          ]
        })}
      />
    )
    expect(container.querySelector('path[data-stroke="0"]')?.getAttribute('d')).toBe(
      'M 0 0 L 100 50'
    )
    expect(container.querySelector('.render-label')).toBeNull()
  })

  it('is hidden from assistive technology (the chip is the accessible version)', () => {
    render(<RegionLayer job={layer()} />)
    expect(screen.getByTestId('render-regions')).toHaveAttribute('aria-hidden', 'true')
  })

  it('follows a crop: coordinates are relative to the crop origin', () => {
    const { container } = render(
      <RegionLayer
        job={layer({ viewport: { x: 900, y: 300, w: 700, h: 600 }, scale: 1, strokes: [] })}
      />
    )
    expect(container.querySelector('path[data-region="1"]')?.getAttribute('d')).toBe(
      'M 100 100 L 600 100 L 600 500 L 100 500 Z'
    )
    expect(container.querySelector('svg')).toHaveAttribute('width', '700')
  })
})
