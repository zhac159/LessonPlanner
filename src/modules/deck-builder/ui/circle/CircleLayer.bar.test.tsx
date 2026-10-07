import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@test/render'
import { makeSlide, makeText } from '@shared/deck/testing'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import { CircleLayer } from './CircleLayer'
import type { CircleLayerExtras } from './useCircleLayer'
import type { CircleLayerProps } from '../seams'

const slide = makeSlide('s3', {
  elements: [makeText('body', 'Body', { x: 900, y: 200, w: 800, h: 600 })]
})

const region = (over: Partial<RegionDraft> = {}): RegionDraft => ({
  id: 'r1',
  n: 1,
  slideId: 's3',
  path: [
    [100, 100],
    [400, 100],
    [400, 400],
    [100, 400]
  ],
  bbox: { x: 100, y: 100, w: 300, h: 300 },
  targetElementIds: [],
  ...over
})

const BOX = { scale: 0.5, width: 960, height: 540 }

function setup(props: Partial<CircleLayerProps & CircleLayerExtras> = {}) {
  const handlers = {
    onAddRegion: vi.fn(),
    onExit: vi.fn(),
    onAddAsset: vi.fn(),
    onAskClaude: vi.fn()
  }
  const utils = renderWithApp(
    <CircleLayer
      slide={slide}
      regions={[]}
      highlightedRegionId={null}
      active
      box={BOX}
      {...handlers}
      {...props}
    />
  )
  const overlay = utils.container.querySelector('.region-overlay') as HTMLElement
  const at = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number) =>
    fireEvent[type](overlay, { clientX: x, clientY: y, pointerId: 1, button: 0 })
  const drawLoop = (x: number, y: number, size: number) => {
    at('pointerDown', x, y)
    for (let i = 1; i <= 10; i += 1) at('pointerMove', x + (size * i) / 10, y)
    for (let i = 1; i <= 10; i += 1) at('pointerMove', x + size, y + (size * i) / 10)
    for (let i = 1; i <= 10; i += 1) at('pointerMove', x + size - (size * i) / 10, y + size)
    for (let i = 1; i < 10; i += 1) at('pointerMove', x, y + size - (size * i) / 10)
    at('pointerUp', x, y + size / 2)
  }
  const click = (x: number, y: number) => {
    at('pointerDown', x, y)
    at('pointerUp', x, y)
  }
  return { ...handlers, ...utils, at, drawLoop, click }
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 1920,
    bottom: 1080,
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
})
afterEach(() => vi.restoreAllMocks())

describe('A10: the "Add asset here" bar', () => {
  it('appears once a loop is drawn, with its three controls, named for the region', () => {
    const { drawLoop, onAddRegion, rerender } = setup()
    drawLoop(850, 150, 800)
    const added = onAddRegion.mock.calls[0]![0] as RegionDraft
    // the editor now owns the region and hands it back
    rerender(
      <CircleLayer
        slide={slide}
        regions={[added]}
        highlightedRegionId={null}
        active
        box={BOX}
        onAddRegion={onAddRegion}
        onExit={vi.fn()}
        onAddAsset={vi.fn()}
        onAskClaude={vi.fn()}
      />
    )
    const bar = screen.getByRole('toolbar', { name: `Region ${added.n}` })
    expect(within(bar).getByRole('button', { name: 'Add asset here' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Ask Claude' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Hide these options' })).toBeInTheDocument()
  })

  it('"Add asset here" hands over this region, "Ask Claude" focuses the composer', async () => {
    const { drawLoop, onAddRegion, onAddAsset, onAskClaude, rerender, user } = setup()
    drawLoop(850, 150, 800)
    const added = onAddRegion.mock.calls[0]![0] as RegionDraft
    rerender(
      <CircleLayer
        slide={slide}
        regions={[added]}
        highlightedRegionId={null}
        active
        box={BOX}
        onAddRegion={onAddRegion}
        onExit={vi.fn()}
        onAddAsset={onAddAsset}
        onAskClaude={onAskClaude}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Add asset here' }))
    expect(onAddAsset).toHaveBeenCalledWith(added.id)
    await user.click(screen.getByRole('button', { name: 'Ask Claude' }))
    expect(onAskClaude).toHaveBeenCalledTimes(1)
  })

  it('× hides only the bar; clicking the loop brings it back', async () => {
    const { user, click, onAddAsset } = setup({ regions: [region()] })
    // an existing region has no bar until the loop is clicked
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    click(250, 250)
    expect(screen.getByRole('toolbar', { name: 'Region 1' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide these options' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    click(250, 250)
    expect(screen.getByRole('toolbar', { name: 'Region 1' })).toBeInTheDocument()
    expect(onAddAsset).not.toHaveBeenCalled()
  })

  it('moves to the loop that was clicked', () => {
    const { click } = setup({
      regions: [
        region(),
        region({
          id: 'r2',
          n: 2,
          path: [
            [1000, 600],
            [1300, 600],
            [1300, 900],
            [1000, 900]
          ],
          bbox: { x: 1000, y: 600, w: 300, h: 300 }
        })
      ]
    })
    click(250, 250)
    expect(screen.getByRole('toolbar', { name: 'Region 1' })).toBeInTheDocument()
    click(1150, 750)
    expect(screen.getByRole('toolbar', { name: 'Region 2' })).toBeInTheDocument()
    expect(screen.queryByRole('toolbar', { name: 'Region 1' })).not.toBeInTheDocument()
  })

  it('Esc hides the bar first, then deselects, then leaves the tool', () => {
    const { click, onExit } = setup({ regions: [region()] })
    click(250, 250)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(onExit).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' }) // deselects the loop
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('sits inside the stage next to the loop’s bottom-right corner', () => {
    const { click } = setup({ regions: [region()] })
    click(250, 250)
    const bar = screen.getByRole('toolbar')
    // loop box 100..400 at scale 0.5: right edge 200 → clamped to the bar's width; 8 below the bottom (200)
    expect(parseFloat(bar.style.top)).toBeCloseTo(208)
    expect(parseFloat(bar.style.left)).toBeGreaterThan(0)
    expect(parseFloat(bar.style.left)).toBeLessThanOrEqual(BOX.width)
  })

  it('is off when the tool is off or the editor does not wire it', () => {
    const off = setup({ regions: [region()], active: false })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    off.unmount()
    const bare = setup({ regions: [region()], box: undefined })
    bare.click(250, 250)
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })
})
