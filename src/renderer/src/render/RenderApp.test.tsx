import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RenderBridge, RenderJob } from '@shared/annotate/renderJob'
import { fixtureDeck, fixtureStyle } from '@shared/deck/testing'
import { RenderApp } from './RenderApp'

const jobFor = (id: string, slideIndex: number): RenderJob => ({
  id,
  slide: fixtureDeck().slides[slideIndex],
  style: fixtureStyle(),
  assets: {},
  viewport: { x: 0, y: 0, w: 1920, h: 1080 },
  scale: 0.25,
  regions: [],
  strokes: []
})

function fakeBridge() {
  const order: string[] = []
  let listener: ((job: RenderJob) => void) | null = null
  const unsubscribe = vi.fn()
  const bridge: RenderBridge = {
    onJob: (next) => {
      order.push('onJob')
      listener = next
      return unsubscribe
    },
    listening: () => {
      order.push('listening')
    },
    report: vi.fn()
  }
  return { bridge, order, unsubscribe, send: (job: RenderJob) => act(() => listener?.(job)) }
}

const settled = () => Promise.resolve()

describe('RenderApp', () => {
  it('shows nothing until a job arrives', () => {
    const { bridge } = fakeBridge()
    const { container } = render(<RenderApp bridge={bridge} settle={settled} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('subscribes to jobs before telling main it is listening', () => {
    const { bridge, order } = fakeBridge()
    render(<RenderApp bridge={bridge} settle={settled} />)
    expect(order).toEqual(['onJob', 'listening'])
  })

  it('draws a job and reports it through the bridge', async () => {
    const { bridge, send } = fakeBridge()
    render(<RenderApp bridge={bridge} settle={settled} />)
    send(jobFor('job-1', 0))
    expect(screen.getByText(/Lesson 3/i)).toBeInTheDocument()
    await waitFor(() => expect(bridge.report).toHaveBeenCalledWith({ id: 'job-1', ok: true }))
  })

  it('replaces the drawing when the next job arrives and reports that job too', async () => {
    const { bridge, send } = fakeBridge()
    const { container } = render(<RenderApp bridge={bridge} settle={settled} />)
    send(jobFor('job-1', 0))
    await waitFor(() => expect(bridge.report).toHaveBeenCalledTimes(1))
    send(jobFor('job-2', 1))
    await waitFor(() => expect(bridge.report).toHaveBeenCalledWith({ id: 'job-2', ok: true }))
    expect(container.querySelectorAll('.render-stage')).toHaveLength(1)
    expect(container.querySelector('.render-stage')).toHaveAttribute('data-job-id', 'job-2')
    expect(container.querySelector('[data-slide-id="s2"]')).not.toBeNull()
    expect(container.querySelector('[data-slide-id="s1"]')).toBeNull()
  })

  it('unsubscribes when it is removed', () => {
    const { bridge, unsubscribe } = fakeBridge()
    const { unmount } = render(<RenderApp bridge={bridge} settle={settled} />)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
