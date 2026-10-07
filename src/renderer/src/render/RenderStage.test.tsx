import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RenderJob } from '@shared/annotate/renderJob'
import { fixtureDeck, fixtureStyle, makeSlide } from '@shared/deck/testing'
import type { ImageElement } from '@shared/deck/types'
import { RenderStage } from './RenderStage'
import type { waitUntilSettled } from './settle'

const job = (over: Partial<RenderJob> = {}): RenderJob => ({
  id: 'job-1',
  slide: fixtureDeck().slides[2],
  style: fixtureStyle(),
  assets: {},
  viewport: { x: 0, y: 0, w: 1920, h: 1080 },
  scale: 0.5,
  regions: [],
  strokes: [],
  ...over
})

const settled = () => vi.fn<typeof waitUntilSettled>(async () => undefined)

describe('RenderStage: drawing', () => {
  it('is exactly the size of the image, with the slide inside', () => {
    const { container } = render(<RenderStage job={job()} onReport={vi.fn()} settle={settled()} />)
    const stage = container.querySelector('.render-stage') as HTMLElement
    expect(stage.style.width).toBe('960px')
    expect(stage.style.height).toBe('540px')
    expect(stage).toHaveAttribute('data-job-id', 'job-1')
    expect(screen.getByText('What do plants need to')).toBeInTheDocument()
  })

  it('draws the slide at the job scale with no offset for a whole slide', () => {
    const { container } = render(<RenderStage job={job()} onReport={vi.fn()} settle={settled()} />)
    const holder = container.querySelector('.render-stage__slide') as HTMLElement
    expect(holder.style.width).toBe('960px')
    expect(holder.style.transform).toBe('translate(0px, 0px)')
    expect((container.querySelector('.slide-canvas') as HTMLElement).style.transform).toBe(
      'scale(0.5)'
    )
  })

  it('shows only the viewport of a crop: smaller image, slide shifted up and left', () => {
    const { container } = render(
      <RenderStage
        job={job({ viewport: { x: 900, y: 300, w: 600, h: 480 }, scale: 1 })}
        onReport={vi.fn()}
        settle={settled()}
      />
    )
    const stage = container.querySelector('.render-stage') as HTMLElement
    expect([stage.style.width, stage.style.height]).toEqual(['600px', '480px'])
    expect((container.querySelector('.render-stage__slide') as HTMLElement).style.transform).toBe(
      'translate(-900px, -300px)'
    )
  })

  it('draws the region loops and strokes over the slide', () => {
    const { container } = render(
      <RenderStage
        job={job({
          regions: [
            {
              n: 3,
              path: [
                [100, 100],
                [400, 100],
                [400, 300]
              ],
              bbox: { x: 100, y: 100, w: 300, h: 200 }
            }
          ],
          strokes: [
            [
              [0, 0],
              [50, 50]
            ]
          ]
        })}
        onReport={vi.fn()}
        settle={settled()}
      />
    )
    expect(container.querySelector('[data-region="3"]')).not.toBeNull()
    expect(container.querySelector('[data-stroke="0"]')).not.toBeNull()
    expect(container.querySelector('[data-region-label="3"]')).toHaveTextContent('3')
  })

  it('shows pictures from the job assets and the placeholder when an asset is missing', () => {
    const picture: ImageElement = {
      id: 'pic',
      type: 'image',
      x: 100,
      y: 100,
      w: 400,
      h: 300,
      fit: 'cover',
      alt: 'A leaf',
      assetId: 'leaf.png'
    }
    const slide = makeSlide('s9', { elements: [picture, { ...picture, id: 'gone', assetId: 'x' }] })
    const { container } = render(
      <RenderStage
        job={job({ slide, assets: { 'leaf.png': 'data:image/png;base64,AAAA' } })}
        onReport={vi.fn()}
        settle={settled()}
      />
    )
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })
})

describe('RenderStage: reporting', () => {
  it('reports ok once the page has settled, after waiting on the stage element and fonts', async () => {
    const onReport = vi.fn()
    const settle = settled()
    const { container } = render(<RenderStage job={job()} onReport={onReport} settle={settle} />)
    await waitFor(() => expect(onReport).toHaveBeenCalledWith({ id: 'job-1', ok: true }))
    expect(onReport).toHaveBeenCalledTimes(1)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(settle.mock.calls[0][0]).toBe(container.querySelector('.render-stage'))
    expect(typeof settle.mock.calls[0][1].loadFonts).toBe('function')
  })

  it('reports the reason when settling fails', async () => {
    const onReport = vi.fn()
    render(
      <RenderStage
        job={job()}
        onReport={onReport}
        settle={() => Promise.reject(new Error('fonts exploded'))}
      />
    )
    await waitFor(() =>
      expect(onReport).toHaveBeenCalledWith({ id: 'job-1', ok: false, error: 'fonts exploded' })
    )
  })

  it('reports non-Error failures as text', async () => {
    const onReport = vi.fn()
    render(<RenderStage job={job()} onReport={onReport} settle={() => Promise.reject('boom')} />)
    await waitFor(() =>
      expect(onReport).toHaveBeenCalledWith({ id: 'job-1', ok: false, error: 'boom' })
    )
  })

  it('does not report after it has been removed', async () => {
    const onReport = vi.fn()
    let finish!: () => void
    const settle = () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
    const { unmount } = render(<RenderStage job={job()} onReport={onReport} settle={settle} />)
    unmount()
    finish()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onReport).not.toHaveBeenCalled()
  })

  it('calls the latest onReport and settles only once when the parent re-renders', async () => {
    const first = vi.fn()
    const second = vi.fn()
    let finish!: () => void
    const settle = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const current = job()
    const { rerender } = render(<RenderStage job={current} onReport={first} settle={settle} />)
    rerender(<RenderStage job={current} onReport={second} settle={settle} />)
    finish()
    await waitFor(() => expect(second).toHaveBeenCalledWith({ id: 'job-1', ok: true }))
    expect(first).not.toHaveBeenCalled()
    expect(settle).toHaveBeenCalledTimes(1)
  })
})
