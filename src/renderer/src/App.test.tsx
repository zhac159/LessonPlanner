import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeWindowApi, type FakeWindowApi } from '@test/fakeApi'
import { App } from './App'
import type { UiModule } from './core/types'

const modules: UiModule[] = [
  { id: 'home', title: 'Home', icon: () => null, component: () => <p>home page</p> },
  {
    id: 'editor',
    title: 'Editor',
    icon: () => null,
    chrome: 'rail',
    component: () => <p>editor page</p>
  }
]

let registry: { status: 'loading' } | { status: 'ready'; modules: UiModule[]; issues: [] } = {
  status: 'ready',
  modules,
  issues: []
}
vi.mock('./core/useUiModules', () => ({ useUiModules: () => registry }))
vi.mock('./components/Splash', () => ({
  Splash: ({ ready, onDone }: { ready: boolean; onDone: () => void }) => (
    <div data-testid="splash" data-ready={ready}>
      <button onClick={onDone}>finish splash</button>
    </div>
  )
}))

let api: FakeWindowApi
beforeEach(() => {
  api = installFakeWindowApi()
})
afterEach(() => {
  api.restore()
  delete window.__shell
  registry = { status: 'ready', modules, issues: [] }
})

describe('App', () => {
  it('renders the shell with the active module and the default chrome', async () => {
    render(<App />)
    expect(screen.getByTestId('shell')).toHaveAttribute('data-chrome', 'sidebar')
    expect(await screen.findByText('home page')).toBeInTheDocument()
  })

  it('keeps the shell inert behind the splash until it finishes', async () => {
    render(<App />)
    expect(screen.getByTestId('shell')).toHaveAttribute('inert')
    expect(screen.getByTestId('splash')).toHaveAttribute('data-ready', 'true')
    screen.getByText('finish splash').click()
    await waitFor(() => expect(screen.queryByTestId('splash')).not.toBeInTheDocument())
  })

  it('tells the splash that modules are not ready yet while loading', () => {
    registry = { status: 'loading' }
    render(<App />)
    expect(screen.getByTestId('splash')).toHaveAttribute('data-ready', 'false')
  })

  it('does not expose the test hook outside test mode', () => {
    render(<App />)
    expect(window.__shell).toBeUndefined()
  })

  it('exposes window.__shell in test mode and follows navigation', async () => {
    api.restore()
    api = installFakeWindowApi({ testMode: true })
    render(<App />)
    await waitFor(() => expect(window.__shell).toBeDefined())
    expect(window.__shell?.getState().activeId).toBe('home')
    window.__shell?.navigate('editor')
    await waitFor(() => expect(screen.getByTestId('shell')).toHaveAttribute('data-chrome', 'rail'))
    expect(window.__shell?.getState().activeId).toBe('editor')
  })

  it('removes window.__shell when unmounted', async () => {
    api.restore()
    api = installFakeWindowApi({ testMode: true })
    const { unmount } = render(<App />)
    await waitFor(() => expect(window.__shell).toBeDefined())
    unmount()
    expect(window.__shell).toBeUndefined()
  })
})
