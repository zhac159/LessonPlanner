import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './TitleBar'

type Listener = (maximized: boolean) => void

function installWindowApi(initiallyMaximized = false) {
  let listener: Listener = () => {}
  const unsubscribe = vi.fn()
  const win = {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(initiallyMaximized),
    onMaximizedChange: vi.fn((fn: Listener) => {
      listener = fn
      return unsubscribe
    })
  }
  Object.defineProperty(window, 'api', { value: { window: win }, configurable: true })
  return { win, unsubscribe, emit: (value: boolean) => listener(value) }
}

describe('TitleBar (wired)', () => {
  let api: ReturnType<typeof installWindowApi>
  beforeEach(() => {
    api = installWindowApi()
  })
  afterEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('shows the app name', async () => {
    render(<TitleBar floating={false} />)
    expect(screen.getByText('Slide Planner')).toBeInTheDocument()
    await waitFor(() => expect(api.win.isMaximized).toHaveBeenCalled())
  })

  it('forwards the three buttons to the window', async () => {
    const user = userEvent.setup()
    render(<TitleBar floating={false} />)
    await user.click(screen.getByTestId('window-minimize'))
    await user.click(screen.getByTestId('window-maximize'))
    await user.click(screen.getByTestId('window-close'))
    expect(api.win.minimize).toHaveBeenCalledTimes(1)
    expect(api.win.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(api.win.close).toHaveBeenCalledTimes(1)
  })

  it('reflects the initial and changing maximised state', async () => {
    api = installWindowApi(true)
    render(<TitleBar floating={false} />)
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument()
    act(() => api.emit(false))
    expect(screen.getByRole('button', { name: 'Maximise' })).toBeInTheDocument()
  })

  it('passes the floating flag through', () => {
    render(<TitleBar floating />)
    expect(screen.getByTestId('titlebar')).toHaveAttribute('data-floating', 'true')
  })

  it('turns inactive when the window loses focus and back when it returns', () => {
    render(<TitleBar floating={false} />)
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(screen.getByTestId('titlebar')).toHaveAttribute('data-inactive', 'true')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.getByTestId('titlebar')).not.toHaveAttribute('data-inactive')
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<TitleBar floating={false} />)
    unmount()
    expect(api.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
