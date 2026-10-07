import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Splash } from './Splash'
import { ShellProvider } from './testShell'
import type { ShellState } from '../core/types'

function stubMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }))
}

function setup(props: { ready?: boolean; user?: ShellState['user'] } = {}) {
  const onExitStart = vi.fn()
  const onDone = vi.fn()
  const view = (ready: boolean) => (
    <ShellProvider
      shell={{
        user: props.user === undefined ? { name: 'Alice', claudeConnected: true } : props.user
      }}
    >
      <Splash ready={ready} onExitStart={onExitStart} onDone={onDone} />
    </ShellProvider>
  )
  const result = render(view(props.ready ?? true))
  return {
    onExitStart,
    onDone,
    unmount: result.unmount,
    setReady: (ready: boolean) => result.rerender(view(ready))
  }
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('Splash', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
    stubMotion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('greets the user by name: a small Welcome and the name letter by letter', () => {
    setup()
    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(screen.getByText('Welcome Alice')).toHaveClass('sr-only')
    const name = screen.getByTestId('splash-name')
    expect(name.textContent).toBe('Alice')
    expect(name.querySelectorAll('.splash__letter')).toHaveLength(5)
    expect(screen.getByText('Welcome', { selector: '.splash__welcome' })).toBeInTheDocument()
  })

  it('says just "Welcome" when the name is not known yet', () => {
    setup({ user: null })
    expect(screen.getByTestId('splash-name').textContent).toBe('Welcome')
    expect(screen.getByTestId('splash-name')).toHaveAttribute('data-greeting', 'true')
    expect(document.querySelector('.splash__welcome')).toBeNull()
    expect(screen.getByText('Welcome', { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('treats a blank name as unknown', () => {
    setup({ user: { name: '   ', claudeConnected: false } })
    expect(screen.getByTestId('splash-name').textContent).toBe('Welcome')
  })

  it('exits after the intro has played, then reports done', () => {
    const { onExitStart, onDone } = setup()
    advance(3199)
    expect(onExitStart).not.toHaveBeenCalled()
    advance(2)
    expect(onExitStart).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('splash')).toHaveAttribute('data-exiting', 'true')
    expect(onDone).not.toHaveBeenCalled()
    advance(600)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('waits for the app to be ready before exiting', () => {
    const { onExitStart, setReady } = setup({ ready: false })
    advance(10_000)
    expect(onExitStart).not.toHaveBeenCalled()
    setReady(true)
    expect(onExitStart).toHaveBeenCalledTimes(1)
  })

  it('ignores a click in the first moments but skips on a later one', () => {
    const { onExitStart } = setup()
    advance(300)
    act(() => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    expect(onExitStart).not.toHaveBeenCalled()
    advance(600)
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(onExitStart).toHaveBeenCalledTimes(1)
  })

  it('plays a shorter intro with reduced motion', () => {
    stubMotion(true)
    const { onExitStart } = setup()
    advance(1201)
    expect(onExitStart).toHaveBeenCalledTimes(1)
  })

  it('announces itself as a polite status region', () => {
    setup()
    expect(screen.getByTestId('splash')).toHaveAttribute('role', 'status')
  })

  it('stops its timers and listeners when unmounted early', () => {
    const { onExitStart, onDone, unmount } = setup()
    unmount()
    advance(5000)
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    expect(onExitStart).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
