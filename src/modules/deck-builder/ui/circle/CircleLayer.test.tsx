import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@test/render'
import { makeSlide, makeText } from '@shared/deck/testing'
import type { RegionDraft } from '@shared/contracts/deck-builder-chat'
import { CircleLayer } from './CircleLayer'
import { TOO_MANY_REGIONS } from './useCircleLayer'
import { setSentHighlight } from './sentHighlight'
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

function setup(props: Partial<CircleLayerProps & { onRemoveRegion(id: string): void }> = {}) {
  const handlers = { onAddRegion: vi.fn(), onExit: vi.fn(), onRemoveRegion: vi.fn() }
  const utils = renderWithApp(
    <CircleLayer
      slide={slide}
      regions={[]}
      highlightedRegionId={null}
      active
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
  return { ...handlers, ...utils, overlay, at, drawLoop }
}

beforeEach(() => {
  // happy-dom has no layout: report the overlay as exactly slide-sized so client pixels are slide units.
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
afterEach(() => {
  vi.restoreAllMocks()
  setSentHighlight(null)
})

describe('CircleLayer drawing', () => {
  it('turns a finished loop into a numbered, hit-tested region', () => {
    const { drawLoop, onAddRegion } = setup()
    drawLoop(850, 150, 800)
    expect(onAddRegion).toHaveBeenCalledTimes(1)
    const added = onAddRegion.mock.calls[0][0] as RegionDraft
    expect(added).toMatchObject({ n: 1, slideId: 's3', targetElementIds: ['body'] })
    expect(added.bbox).toEqual({ x: 850, y: 150, w: 800, h: 800 })
    expect(added.path.length).toBeLessThan(12)
    expect(added.id).toMatch(/^region-/)
  })

  it('numbers the next region one above the highest, across slides', () => {
    const { drawLoop, onAddRegion } = setup({
      regions: [region({ id: 'a', n: 1 }), region({ id: 'b', n: 4, slideId: 's9' })]
    })
    drawLoop(850, 150, 800)
    expect((onAddRegion.mock.calls[0][0] as RegionDraft).n).toBe(5)
  })

  it('discards a tiny loop instead of adding a region', () => {
    const { drawLoop, onAddRegion } = setup()
    drawLoop(900, 300, 20)
    expect(onAddRegion).not.toHaveBeenCalled()
  })

  it('stops at nine regions with a toast', () => {
    const nine = Array.from({ length: 9 }, (_, i) => region({ id: `r${i}`, n: i + 1 }))
    const { drawLoop, onAddRegion } = setup({ regions: nine })
    drawLoop(850, 150, 800)
    expect(onAddRegion).not.toHaveBeenCalled()
    expect(screen.getByText(TOO_MANY_REGIONS)).toBeInTheDocument()
  })

  it('does not draw when the tool is off', () => {
    const { overlay, onAddRegion } = setup({ active: false })
    expect(overlay).not.toHaveAttribute('data-active')
    expect(onAddRegion).not.toHaveBeenCalled()
  })
})

describe('CircleLayer regions on the slide', () => {
  it('shows the number of each region on this slide only', () => {
    setup({ regions: [region(), region({ id: 'x', n: 2, slideId: 'other' })] })
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('dims everything outside the highlighted region', () => {
    const { container, rerender } = setup({ regions: [region()] })
    expect(container.querySelector('.region-overlay__dim')).toBeNull()
    rerender(
      <CircleLayer
        slide={slide}
        regions={[region()]}
        highlightedRegionId="r1"
        active
        onAddRegion={vi.fn()}
        onExit={vi.fn()}
      />
    )
    expect(container.querySelector('.region-overlay__dim')).not.toBeNull()
  })

  it('re-draws a sent region with its caption while its chip is hovered', () => {
    const { container } = setup()
    act(() =>
      setSentHighlight({
        id: 'sent:1',
        n: 2,
        slideId: 's3',
        path: region().path,
        caption: 'Swap this photo for…'
      })
    )
    expect(screen.getByText('Swap this photo for…')).toBeInTheDocument()
    expect(container.querySelector('.region-overlay__dim')).not.toBeNull()
    act(() => setSentHighlight(null))
    expect(screen.queryByText('Swap this photo for…')).not.toBeInTheDocument()
  })

  it('ignores a sent region that belongs to another slide', () => {
    setup()
    act(() =>
      setSentHighlight({ id: 'sent:1', n: 2, slideId: 'other', path: region().path, caption: 'Hi' })
    )
    expect(screen.queryByText('Hi')).not.toBeInTheDocument()
  })
})

describe('CircleLayer selecting and leaving', () => {
  it('selects a loop by clicking inside it and removes it with Delete', () => {
    const { at, onRemoveRegion } = setup({ regions: [region()] })
    at('pointerDown', 200, 200)
    at('pointerUp', 200, 200)
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(onRemoveRegion).toHaveBeenCalledWith('r1')
  })

  it('Esc deselects first and leaves the tool on the second press', () => {
    const { at, onExit } = setup({ regions: [region()] })
    at('pointerDown', 200, 200)
    at('pointerUp', 200, 200)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onExit).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('leaves the tool with a right click', () => {
    const { overlay, onExit } = setup()
    fireEvent.contextMenu(overlay)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores Esc while typing in a text field', () => {
    const { onExit } = setup()
    const field = document.createElement('textarea')
    document.body.append(field)
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(onExit).not.toHaveBeenCalled()
    field.remove()
  })

  it('removes a region from its label ×', async () => {
    const { user, onRemoveRegion } = setup({ regions: [region()] })
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(onRemoveRegion).toHaveBeenCalledWith('r1')
  })
})
