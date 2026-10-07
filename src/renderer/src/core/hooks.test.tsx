import { render, renderHook, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { installFakeWindowApi } from '@test/fakeApi'
import { createFakeClients, fakeClient } from '@test/fakeClients'
import { ClientsProvider, createClients } from './ClientsContext'
import { useClient, useEvent } from './hooks'

interface DemoApi {
  greet(name: string): string
}
interface DemoEvents {
  'demo:progress': { done: number }
  'demo:done': { ok: boolean }
}

const wrapperFor = (clients: ReturnType<typeof createFakeClients>) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ClientsProvider clients={clients}>{children}</ClientsProvider>
  }

describe('useClient', () => {
  it('returns the provided client for any module id, with stable identity', () => {
    const demo = fakeClient<DemoApi>({ greet: (n) => `Hi ${n}` })
    const clients = createFakeClients({ demo })
    const { result, rerender } = renderHook(() => useClient<DemoApi>('demo'), {
      wrapper: wrapperFor(clients)
    })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(first).toBe(demo)
  })

  it('by default calls window.api.modules.invoke with the module id and method name', async () => {
    const invoke = vi.fn(async () => 'Hi Ada')
    const fake = installFakeWindowApi({ modules: { invoke: invoke as never } })
    try {
      const { result } = renderHook(() => useClient<DemoApi>('demo'))
      await expect(result.current.greet('Ada')).resolves.toBe('Hi Ada')
      expect(invoke).toHaveBeenCalledWith('demo', 'greet', 'Ada')
    } finally {
      fake.restore()
    }
  })
})

describe('createClients', () => {
  it('caches one client per module and reads the bridge lazily', async () => {
    const invoke = vi.fn(async () => 1)
    const on = vi.fn(() => () => {})
    const clients = createClients(() => ({ invoke: invoke as never, on }))
    expect(clients.client('a')).toBe(clients.client('a'))
    expect(clients.client('a')).not.toBe(clients.client('b'))
    await (clients.client<{ ping(): number }>('b').ping as () => Promise<number>)()
    expect(invoke).toHaveBeenCalledWith('b', 'ping')
    clients.subscribe('a', 'evt', () => {})
    expect(on).toHaveBeenCalledWith('a', 'evt', expect.any(Function))
  })
})

describe('useEvent', () => {
  function Listener({ onProgress }: { onProgress: (done: number) => void }) {
    useEvent<DemoEvents, 'demo:progress'>('demo', 'demo:progress', (p) => onProgress(p.done))
    return <p>listening</p>
  }

  it('delivers matching events to the latest handler', () => {
    const clients = createFakeClients()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Listener onProgress={first} />, { wrapper: wrapperFor(clients) })
    act(() => clients.emit('demo', 'demo:progress', { done: 1 }))
    rerender(<Listener onProgress={second} />)
    act(() => clients.emit('demo', 'demo:progress', { done: 2 }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledWith(1)
    expect(second).toHaveBeenCalledWith(2)
  })

  it('ignores other events and modules', () => {
    const clients = createFakeClients()
    const onProgress = vi.fn()
    render(<Listener onProgress={onProgress} />, { wrapper: wrapperFor(clients) })
    act(() => {
      clients.emit('demo', 'demo:done', { ok: true })
      clients.emit('other', 'demo:progress', { done: 5 })
    })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const clients = createFakeClients()
    const onProgress = vi.fn()
    const { unmount } = render(<Listener onProgress={onProgress} />, {
      wrapper: wrapperFor(clients)
    })
    expect(screen.getByText('listening')).toBeInTheDocument()
    unmount()
    clients.emit('demo', 'demo:progress', { done: 9 })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('subscribes once even when the handler identity changes every render', () => {
    const subscribe = vi.fn(() => () => {})
    const clients = { ...createFakeClients(), subscribe }
    const { rerender } = render(<Listener onProgress={() => {}} />, {
      wrapper: wrapperFor(clients)
    })
    rerender(<Listener onProgress={() => {}} />)
    expect(subscribe).toHaveBeenCalledTimes(1)
  })
})
