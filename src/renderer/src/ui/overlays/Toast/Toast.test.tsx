import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast, type ToastApi } from './ToastProvider'

let api: ToastApi
function Capture() {
  api = useToast()
  return null
}

function setup() {
  render(
    <ToastProvider>
      <Capture />
    </ToastProvider>
  )
}

describe('ToastProvider', () => {
  it('throws a helpful error when useToast is used without a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Capture />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })

  it('renders a polite notification region', () => {
    setup()
    const region = screen.getByRole('region', { name: 'Notifications' })
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('shows a message and closes it with the dismiss button', async () => {
    setup()
    act(() => {
      api.show({ message: 'Lesson deleted' })
    })
    expect(screen.getByText('Lesson deleted')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Lesson deleted')).not.toBeInTheDocument()
  })

  it('runs the action once and closes the toast', async () => {
    const onAction = vi.fn()
    setup()
    act(() => {
      api.show({ message: 'Removed notes.pdf', action: { label: 'Undo', onAction } })
    })
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Removed notes.pdf')).not.toBeInTheDocument()
  })

  it('can be closed by id', () => {
    setup()
    let id = ''
    act(() => {
      id = api.show({ message: 'Hello' })
    })
    act(() => api.dismiss(id))
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
  })

  it('announces errors assertively', () => {
    setup()
    act(() => {
      api.show({ message: 'Could not save', tone: 'error' })
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
  })

  it('keeps at most three toasts', () => {
    setup()
    act(() => {
      for (const n of [1, 2, 3, 4]) api.show({ message: `msg ${n}` })
    })
    expect(screen.queryByText('msg 1')).not.toBeInTheDocument()
    expect(screen.getByText('msg 4')).toBeInTheDocument()
  })
})

describe('Toast auto-dismiss', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('disappears after its duration', () => {
    setup()
    act(() => {
      api.show({ message: 'Saved', durationMs: 1000 })
    })
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('gives toasts with an action six seconds', () => {
    setup()
    act(() => {
      api.show({ message: 'Removed', action: { label: 'Undo', onAction() {} } })
    })
    act(() => {
      vi.advanceTimersByTime(5900)
    })
    expect(screen.getByText('Removed')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByText('Removed')).not.toBeInTheDocument()
  })

  it('pauses while hovered and restarts afterwards', () => {
    setup()
    act(() => {
      api.show({ message: 'Hold on', durationMs: 1000 })
    })
    const toast = screen.getByText('Hold on').parentElement!
    fireEvent.mouseEnter(toast)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Hold on')).toBeInTheDocument()
    fireEvent.mouseLeave(toast)
    act(() => {
      vi.advanceTimersByTime(1001)
    })
    expect(screen.queryByText('Hold on')).not.toBeInTheDocument()
  })

  it('pauses while a control inside has keyboard focus', () => {
    setup()
    act(() => {
      api.show({ message: 'Focus me', durationMs: 1000, action: { label: 'Undo', onAction() {} } })
    })
    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText('Focus me')).toBeInTheDocument()
  })
})

describe('Toast keyboard use', () => {
  it('toasts are reachable by keyboard', async () => {
    setup()
    act(() => {
      api.show({ message: 'Tab to me', action: { label: 'Undo', onAction() {} } })
    })
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })
})
