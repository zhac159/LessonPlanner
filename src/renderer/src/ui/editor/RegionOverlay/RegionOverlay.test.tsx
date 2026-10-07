import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegionOverlay, type OverlayRegion, type RegionOverlayProps } from './RegionOverlay'

const LOOP: OverlayRegion['path'] = [
  [200, 200],
  [600, 200],
  [600, 500],
  [200, 500]
]

function setup(props: Partial<RegionOverlayProps> = {}) {
  const handlers = { onComplete: vi.fn(), onPoint: vi.fn(), onCancel: vi.fn() }
  const utils = render(<RegionOverlay active regions={[]} scale={0.5} {...handlers} {...props} />)
  const root = utils.container.firstElementChild as HTMLElement
  const at = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number) =>
    fireEvent[type](root, { clientX: x, clientY: y, pointerId: 1, button: 0 })
  return { ...handlers, ...utils, root, at }
}

describe('RegionOverlay drawing with the pointer', () => {
  it('emits the raw points in slide units on release', () => {
    const { at, onComplete } = setup()
    at('pointerDown', 50, 50)
    at('pointerMove', 100, 50)
    at('pointerMove', 100, 100)
    at('pointerMove', 50, 100)
    at('pointerUp', 50, 100)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith([
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200]
    ])
  })

  it('gives the same slide coordinates at any scale', () => {
    const { at, onComplete } = setup({ scale: 0.25 })
    at('pointerDown', 25, 25)
    at('pointerMove', 50, 50)
    at('pointerUp', 50, 50)
    expect(onComplete).toHaveBeenCalledWith([
      [100, 100],
      [200, 200]
    ])
  })

  it('draws the live stroke while the pointer is down', () => {
    const { at, container } = setup()
    expect(container.querySelectorAll('.region-overlay__stroke')).toHaveLength(0)
    at('pointerDown', 50, 50)
    at('pointerMove', 100, 100)
    const live = container.querySelector('.region-overlay__stroke')
    expect(live).toHaveAttribute('d', 'M100 100 L200 200')
    expect(container.firstElementChild).toHaveAttribute('data-drawing', 'true')
  })

  it('reports a click without movement as a point, not a loop', () => {
    const { at, onComplete, onPoint } = setup()
    at('pointerDown', 50, 60)
    at('pointerUp', 50, 60)
    expect(onComplete).not.toHaveBeenCalled()
    expect(onPoint).toHaveBeenCalledWith([100, 120])
  })

  it('ignores repeated identical positions', () => {
    const { at, onComplete } = setup()
    at('pointerDown', 50, 50)
    at('pointerMove', 50, 50)
    at('pointerMove', 80, 80)
    at('pointerUp', 80, 80)
    expect(onComplete.mock.calls[0][0]).toHaveLength(2)
  })

  it('ignores moves from a different pointer and non-primary buttons', () => {
    const { at, root, onComplete, onPoint } = setup()
    fireEvent.pointerDown(root, { clientX: 10, clientY: 10, pointerId: 1, button: 2 })
    at('pointerUp', 10, 10)
    expect(onComplete).not.toHaveBeenCalled()
    expect(onPoint).not.toHaveBeenCalled()
    at('pointerDown', 50, 50)
    fireEvent.pointerMove(root, { clientX: 500, clientY: 500, pointerId: 7 })
    at('pointerMove', 60, 60)
    at('pointerUp', 60, 60)
    expect(onComplete).toHaveBeenCalledWith([
      [100, 100],
      [120, 120]
    ])
  })

  it('cancels with Esc and emits nothing', () => {
    const { at, onComplete, onCancel, container } = setup()
    at('pointerDown', 50, 50)
    at('pointerMove', 100, 100)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('.region-overlay__stroke')).toHaveLength(0)
    at('pointerUp', 100, 100)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not swallow Esc when no stroke is in progress', () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const { onCancel } = setup()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    document.removeEventListener('keydown', outer)
    expect(outer).toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancels when the pointer is cancelled', () => {
    const { at, root, onCancel, onComplete } = setup()
    at('pointerDown', 50, 50)
    fireEvent.pointerCancel(root, { pointerId: 1 })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('drops a stroke in progress when the tool is switched off', () => {
    const { at, rerender, onCancel, onComplete, root } = setup()
    at('pointerDown', 50, 50)
    at('pointerMove', 80, 80)
    rerender(
      <RegionOverlay active={false} regions={[]} onComplete={onComplete} onCancel={onCancel} />
    )
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(root).not.toHaveAttribute('data-drawing')
  })

  it('ignores the pointer when inactive', () => {
    const { at, onComplete, onPoint, root } = setup({ active: false })
    expect(root).not.toHaveAttribute('data-active')
    at('pointerDown', 50, 50)
    at('pointerMove', 80, 80)
    at('pointerUp', 80, 80)
    expect(onComplete).not.toHaveBeenCalled()
    expect(onPoint).not.toHaveBeenCalled()
  })
})

describe('RegionOverlay keyboard alternative', () => {
  it('is a focusable, named, described application region only while active', () => {
    const { root, rerender } = setup()
    expect(root).toHaveAttribute('role', 'application')
    expect(root).toHaveAttribute('aria-label', 'Circle to edit')
    expect(root).toHaveAttribute('tabindex', '0')
    expect(root.getAttribute('aria-description')).toMatch(/Arrow keys move the pen/)
    rerender(<RegionOverlay active={false} regions={[]} onComplete={() => {}} />)
    expect(root).not.toHaveAttribute('tabindex')
    expect(root).not.toHaveAttribute('role')
  })

  it('draws a loop with arrows and Enter and emits the raw points', async () => {
    const { root, onComplete } = setup()
    await userEvent.tab()
    expect(root).toHaveFocus()
    await userEvent.keyboard('{Enter}{ArrowRight}{ArrowDown}{ArrowLeft}{Enter}')
    expect(onComplete).toHaveBeenCalledWith([
      [960, 540],
      [1000, 540],
      [1000, 580],
      [960, 580]
    ])
  })

  it('shows the pen cursor while focused and the loop while drawing', async () => {
    const { container } = setup()
    expect(container.querySelector('.region-overlay__cursor')).toBeNull()
    await userEvent.tab()
    expect(container.querySelector('.region-overlay__cursor')).toHaveAttribute('cx', '960')
    await userEvent.keyboard('{Enter}{ArrowRight}')
    expect(container.querySelector('.region-overlay__stroke')).toHaveAttribute(
      'd',
      'M960 540 L1000 540'
    )
  })

  it('cancels with Esc and keeps the key from reaching the stage', async () => {
    const stage = vi.fn()
    const { onCancel, onComplete } = setup()
    document.addEventListener('keydown', stage)
    await userEvent.tab()
    await userEvent.keyboard('{Enter}{ArrowRight}{Escape}')
    document.removeEventListener('keydown', stage)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('abandons a loop when focus leaves', async () => {
    const { onCancel } = setup()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}{ArrowRight}')
    await userEvent.tab()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('RegionOverlay regions', () => {
  const regions: OverlayRegion[] = [
    { id: 'a', n: 1, path: LOOP, caption: 'Swap for a diagram' },
    {
      id: 'b',
      n: 2,
      path: [
        [1000, 600],
        [1400, 600],
        [1400, 900]
      ],
      linked: true
    }
  ]

  it('draws one closed path per region, thicker when linked', () => {
    const { container } = setup({ active: false, regions })
    const paths = container.querySelectorAll('.region-overlay__stroke')
    expect(paths).toHaveLength(2)
    expect(paths[0]).toHaveAttribute('d', 'M200 200 L600 200 L600 500 L200 500 Z')
    expect(paths[0]).not.toHaveAttribute('data-linked')
    expect(paths[1]).toHaveAttribute('data-linked', 'true')
  })

  it('is hidden from assistive technology (the chips are the accessible version)', () => {
    const { container } = setup({ active: false, regions })
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('pins a label to each region with its number and caption', () => {
    const { container } = setup({ active: false, regions })
    const labels = container.querySelectorAll<HTMLElement>('.region-overlay__label')
    expect(labels).toHaveLength(2)
    expect(labels[0]).toHaveTextContent('1')
    expect(labels[0]).toHaveTextContent('Swap for a diagram')
    expect(labels[1]).toHaveTextContent('Circled')
    expect(labels[0].style.getPropertyValue('--label-left')).toBe('8.416666666666668%')
  })

  it('dims everything outside the active region only', () => {
    const { container, rerender } = setup({ active: false, regions })
    expect(container.querySelector('.region-overlay__dim')).toBeNull()
    rerender(
      <RegionOverlay active={false} regions={regions} activeRegionId="a" onComplete={() => {}} />
    )
    const dim = container.querySelector('.region-overlay__dim')
    expect(dim?.getAttribute('d')).toContain('M200 200 L600 200 L600 500 L200 500 Z')
  })

  it('makes labels removable when asked', async () => {
    const onRemoveRegion = vi.fn()
    setup({ active: false, regions, onRemoveRegion })
    await userEvent.click(screen.getByRole('button', { name: 'Remove region 2' }))
    expect(onRemoveRegion).toHaveBeenCalledWith('b')
  })

  it('does not start a stroke from a label button', async () => {
    const onRemoveRegion = vi.fn()
    const { onComplete, onPoint } = setup({ regions, onRemoveRegion })
    await userEvent.click(screen.getByRole('button', { name: 'Remove region 1' }))
    expect(onRemoveRegion).toHaveBeenCalledWith('a')
    expect(onComplete).not.toHaveBeenCalled()
    expect(onPoint).not.toHaveBeenCalled()
  })

  it('skips regions without points', () => {
    const { container } = setup({ active: false, regions: [{ id: 'x', n: 1, path: [] }] })
    expect(container.querySelector('.region-overlay__label')).toBeNull()
  })
})
