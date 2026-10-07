/**
 * Render helpers for component tests.
 *
 *   const settings = fakeClient<SettingsApi>({ getProfile: () => ok({ profile }) })
 *   const { user, shell } = renderWithApp(<HomeView />, {
 *     clients: createFakeClients({ settings }),   // what hooks like useClient() talk to
 *     shell: { activeId: 'home' }                  // overrides on top of a fake ShellState
 *   })
 *   await user.click(screen.getByRole('button', { name: 'New lesson' }))
 *   expect(shell.navigate).toHaveBeenCalledWith('deck-builder', { kind: 'new-lesson' })
 *
 * Defaults: no modules, no user, chrome 'sidebar', `navigate` & co. are `vi.fn`, every module client
 * rejects ("not implemented") and `window.api` is a fake (./fakeApi.ts). Pass `api` to customise it.
 * For the real shell logic (routing, first run, shortcuts) render `ShellProvider` instead.
 */
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vitest'
import { ClientsProvider, type Clients } from '@renderer/core/ClientsContext'
import { ToastProvider } from '@ui/overlays'
import { ShellContext } from '@renderer/core/ShellContext'
import type { ShellState } from '@renderer/core/types'
import { installFakeWindowApi, type ApiOverrides } from './fakeApi'
import { createFakeClients, type FakeClients } from './fakeClients'

export { createFakeClients, fakeClient, type FakeClients } from './fakeClients'
export { createFakeApi, installFakeWindowApi, type ApiOverrides } from './fakeApi'

/** A complete ShellState with spies for the callbacks; `overrides` win. */
export function fakeShell(overrides: Partial<ShellState> = {}): ShellState {
  return {
    modules: [],
    issues: [],
    activeId: '',
    navigate: vi.fn(),
    intent: null,
    consumeIntent: vi.fn(),
    chrome: 'sidebar',
    setChrome: vi.fn(),
    user: null,
    refreshUser: vi.fn(async () => {}),
    ...overrides
  }
}

export interface RenderWithAppOptions extends Omit<RenderOptions, 'wrapper'> {
  shell?: Partial<ShellState>
  clients?: Clients
  /** Overrides for the fake `window.api`; when omitted an existing `window.api` is left alone. */
  api?: ApiOverrides
}

export type RenderWithAppResult = RenderResult & {
  user: UserEvent
  shell: ShellState
  clients: Clients | FakeClients
}

export function renderWithApp(
  ui: ReactElement,
  {
    shell: shellOverrides,
    clients = createFakeClients(),
    api,
    ...options
  }: RenderWithAppOptions = {}
): RenderWithAppResult {
  if (api || !(window as { api?: unknown }).api) installFakeWindowApi(api)
  const shell = fakeShell(shellOverrides)
  // A wrapper (not inline elements) so `rerender(ui)` keeps the providers.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ShellContext.Provider value={shell}>
      <ClientsProvider clients={clients}>
        <ToastProvider>{children}</ToastProvider>
      </ClientsProvider>
    </ShellContext.Provider>
  )
  const result = render(ui, { ...options, wrapper })
  return { ...result, user: userEvent.setup(), shell, clients }
}
