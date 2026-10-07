import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SettingsApi, UserProfile } from '@shared/contracts/settings'
import type { ContractImpl } from '@shared/contract'
import { fail, ok } from '@shared/result'
import { createFakeClients, fakeClient } from '@test/fakeClients'
import { ShellProvider } from './ShellProvider'
import { useShell } from './ShellContext'
import type { UiModule } from './types'

const mod = (id: string, extra: Partial<UiModule> = {}): UiModule => ({
  id,
  title: id,
  icon: () => null,
  component: () => null,
  ...extra
})

const profile = (step: UserProfile['onboarding']['step'], name: string | null = 'Ms Rivera') =>
  ({
    name,
    subject: null,
    onboarding: { step, completedAt: null, skippedAi: false },
    claudeConnected: true
  }) satisfies UserProfile

const settingsClient = (getProfile: ContractImpl<SettingsApi>['getProfile']) =>
  createFakeClients({ settings: fakeClient<SettingsApi>({ getProfile }) })

/** Renders the shell state as text and exposes buttons that drive it. */
function Probe() {
  const shell = useShell()
  return (
    <div>
      <output aria-label="active">{shell.activeId}</output>
      <output aria-label="intent">{shell.intent ? JSON.stringify(shell.intent) : 'none'}</output>
      <output aria-label="chrome">{shell.chrome}</output>
      <output aria-label="user">
        {shell.user ? `${shell.user.name}|${shell.user.claudeConnected}` : 'none'}
      </output>
      <button onClick={() => shell.navigate('styles')}>go styles</button>
      <button onClick={() => shell.navigate('home', { kind: 'open', lessonId: 'l1' })}>
        go home with intent
      </button>
      <button onClick={() => shell.navigate('nope')}>go nowhere</button>
      <button onClick={() => shell.consumeIntent()}>consume</button>
      <button onClick={() => shell.setChrome('rail')}>set chrome</button>
      <button onClick={() => shell.setChrome(null)}>reset chrome</button>
      <button onClick={() => void shell.refreshUser()}>refresh</button>
    </div>
  )
}

const text = (label: string): string => screen.getByLabelText(label).textContent ?? ''

function renderShell(
  modules: UiModule[],
  clients = createFakeClients(),
  probe: React.ReactElement = <Probe />
) {
  const user = userEvent.setup()
  const result = render(
    <ShellProvider modules={modules} issues={[]} clients={clients}>
      {probe}
    </ShellProvider>
  )
  return { user, ...result }
}

const plain = [mod('home'), mod('styles'), mod('deck-builder'), mod('plugins')]

afterEach(() => vi.restoreAllMocks())

describe('navigation', () => {
  it('starts on the first module and switches with navigate', async () => {
    const { user } = renderShell(plain)
    expect(text('active')).toBe('home')
    await user.click(screen.getByText('go styles'))
    expect(text('active')).toBe('styles')
  })

  it('has no active module while none are loaded', () => {
    renderShell([])
    expect(text('active')).toBe('')
  })

  it('ignores navigation to an unknown module', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { user } = renderShell(plain)
    await user.click(screen.getByText('go nowhere'))
    expect(text('active')).toBe('home')
    expect(warn).toHaveBeenCalledOnce()
  })
})

describe('intents', () => {
  it('delivers the intent to the target module until it is consumed', async () => {
    const { user } = renderShell(plain)
    expect(text('intent')).toBe('none')
    await user.click(screen.getByText('go home with intent'))
    expect(text('intent')).toBe('{"kind":"open","lessonId":"l1"}')
    await user.click(screen.getByText('consume'))
    expect(text('intent')).toBe('none')
  })

  it('drops a pending intent when navigating elsewhere without one', async () => {
    const { user } = renderShell(plain)
    await user.click(screen.getByText('go home with intent'))
    await user.click(screen.getByText('go styles'))
    expect(text('active')).toBe('styles')
    expect(text('intent')).toBe('none')
  })
})

describe('chrome', () => {
  it('defaults to the sidebar', () => {
    renderShell(plain)
    expect(text('chrome')).toBe('sidebar')
  })

  it('uses the active module chrome', () => {
    renderShell([mod('wizard', { chrome: 'none' }), mod('home')])
    expect(text('chrome')).toBe('none')
  })

  it('lets the active module override and restore its chrome without leaking to others', async () => {
    const { user } = renderShell(plain)
    await user.click(screen.getByText('set chrome'))
    expect(text('chrome')).toBe('rail')
    await user.click(screen.getByText('go styles'))
    expect(text('chrome')).toBe('sidebar')
    await user.click(screen.getByText('go home with intent'))
    expect(text('chrome')).toBe('rail')
    await user.click(screen.getByText('reset chrome'))
    expect(text('chrome')).toBe('sidebar')
  })
})

describe('user and first run', () => {
  const withSettings = [mod('home'), mod('settings'), mod('deck-builder')]

  it('routes to Settings with a first-run intent while onboarding is unfinished', async () => {
    renderShell(
      withSettings,
      settingsClient(async () => ok({ profile: profile('about', null) }))
    )
    await waitFor(() => expect(text('active')).toBe('settings'))
    expect(text('intent')).toBe('{"kind":"first-run"}')
    expect(text('user')).toBe('none')
  })

  it('routes to first run when there is no profile yet', async () => {
    renderShell(
      withSettings,
      settingsClient(async () => fail('not-found', 'No profile'))
    )
    await waitFor(() => expect(text('active')).toBe('settings'))
  })

  it('exposes the user and stays put once onboarding is done', async () => {
    renderShell(
      withSettings,
      settingsClient(async () => ok({ profile: profile('done') }))
    )
    await waitFor(() => expect(text('user')).toBe('Ms Rivera|true'))
    expect(text('active')).toBe('home')
    expect(text('intent')).toBe('none')
  })

  it('does not ask settings anything when there is no settings module', () => {
    const getProfile = vi.fn(async () => ok({ profile: profile('about') }))
    renderShell(plain, settingsClient(getProfile))
    expect(getProfile).not.toHaveBeenCalled()
    expect(text('user')).toBe('none')
  })

  it('never crashes when the settings channel is missing', async () => {
    const clients = createFakeClients()
    renderShell(withSettings, clients)
    await waitFor(() =>
      expect(clients.client<SettingsApi>('settings').getProfile).toHaveBeenCalled()
    )
    expect(text('active')).toBe('home')
    expect(text('user')).toBe('none')
  })

  it('refreshUser picks up a finished onboarding', async () => {
    let step: UserProfile['onboarding']['step'] = 'about'
    const { user } = renderShell(
      withSettings,
      settingsClient(async () => ok({ profile: profile(step) }))
    )
    await waitFor(() => expect(text('active')).toBe('settings'))
    step = 'done'
    await user.click(screen.getByText('refresh'))
    await waitFor(() => expect(text('user')).toBe('Ms Rivera|true'))
    expect(text('active')).toBe('settings')
  })
})

describe('global shortcuts', () => {
  const modules = [mod('home'), mod('settings'), mod('deck-builder')]
  const finished = () => settingsClient(async () => ok({ profile: profile('done') }))

  it('Ctrl+N opens a new lesson in the deck builder', async () => {
    const { user } = renderShell(modules, finished())
    await waitFor(() => expect(text('user')).not.toBe('none'))
    await user.keyboard('{Control>}n{/Control}')
    expect(text('active')).toBe('deck-builder')
    expect(text('intent')).toBe('{"kind":"new-lesson"}')
  })

  it('Ctrl+, opens Settings on the AI tab', async () => {
    const { user } = renderShell(modules, finished())
    await waitFor(() => expect(text('user')).not.toBe('none'))
    await user.keyboard('{Control>},{/Control}')
    expect(text('active')).toBe('settings')
    expect(text('intent')).toBe('{"kind":"ai"}')
  })

  it('does nothing during first run', async () => {
    const { user } = renderShell(
      modules,
      settingsClient(async () => ok({ profile: profile('connect') }))
    )
    await waitFor(() => expect(text('active')).toBe('settings'))
    await user.keyboard('{Control>}n{/Control}')
    expect(text('active')).toBe('settings')
    expect(text('intent')).toBe('{"kind":"first-run"}')
  })

  it('ignores plain keys and other modifiers', async () => {
    const { user } = renderShell(modules, finished())
    await waitFor(() => expect(text('user')).not.toBe('none'))
    await user.keyboard('n')
    await user.keyboard('{Control>}{Shift>}n{/Shift}{/Control}')
    expect(text('active')).toBe('home')
  })

  it('stops listening when unmounted', async () => {
    const { user, unmount } = renderShell(modules, finished())
    await waitFor(() => expect(text('user')).not.toBe('none'))
    unmount()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await user.keyboard('{Control>}n{/Control}')
    expect(warn).not.toHaveBeenCalled()
  })
})
