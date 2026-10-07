import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ModuleApi, ShellState } from '@renderer/sdk'
import { createFakeClients, renderWithApp } from '@test/render'
import { SettingsView } from './SettingsView'
import { fakeSettings, type FakeSettingsOptions } from './testSupport'

const api: ModuleApi = { invoke: async () => undefined as never, on: () => () => {} }
const DONE = {
  name: 'Alice',
  onboarding: { step: 'done' as const, completedAt: 'x', skippedAi: false }
}
const CONNECT = { onboarding: { step: 'connect' as const, completedAt: null, skippedAi: false } }

function setup(options: FakeSettingsOptions = {}, shell: Partial<ShellState> = {}, active = true) {
  const settings = fakeSettings(options)
  const view = renderWithApp(<SettingsView api={api} active={active} />, {
    clients: createFakeClients({ settings }),
    shell
  })
  return { ...view, settings }
}

describe('SettingsView first run', () => {
  it('shows the wizard and hides the sidebar while setup is not finished', async () => {
    const { shell } = setup()
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
    expect(shell.setChrome).toHaveBeenCalledWith('none')
  })

  it('resumes at Connect Claude', async () => {
    setup({ profile: CONNECT })
    expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeInTheDocument()
  })

  it('shows the wizard for the first-run intent and consumes it', async () => {
    const { shell } = setup({ profile: DONE }, { intent: { kind: 'first-run' } })
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('restores the sidebar when the module goes away', async () => {
    const { shell, unmount } = setup()
    await screen.findByRole('heading', { name: 'Welcome!' })
    unmount()
    expect(shell.setChrome).toHaveBeenLastCalledWith(null)
  })

  it('does not touch the chrome while another module is active', async () => {
    const { shell } = setup({}, {}, false)
    await screen.findByRole('heading', { name: 'Welcome!' })
    expect(shell.setChrome).not.toHaveBeenCalled()
  })

  it('leaves the wizard for the Settings page and the sidebar back after Skip for now', async () => {
    const { user, shell } = setup({ profile: CONNECT })
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(shell.setChrome).toHaveBeenLastCalledWith(null)
    expect(shell.navigate).toHaveBeenCalledWith('home')
  })

  it('renders nothing until the profile has been read', () => {
    const { container } = setup({
      overrides: { getProfile: () => new Promise(() => {}) }
    })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SettingsView page', () => {
  it('shows the Settings page when setup is finished, with the sidebar chrome untouched', async () => {
    const { shell } = setup({ profile: DONE })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(shell.setChrome).not.toHaveBeenCalled()
  })

  it('opens the page with focus on Claude for the ai intent and consumes the intent', async () => {
    const { shell } = setup({ profile: DONE }, { intent: { kind: 'ai' } })
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Claude' })).toHaveFocus()
    )
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('shows the page, not the wizard, for the ai intent even before setup is finished', async () => {
    setup({}, { intent: { kind: 'ai' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('ignores an intent it does not know but still consumes it', async () => {
    const { shell } = setup({ profile: DONE }, { intent: { kind: 'something-else' } })
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(shell.consumeIntent).toHaveBeenCalled()
  })

  it('falls back to the page when the profile cannot be read', async () => {
    setup({
      overrides: {
        getProfile: () => {
          throw new Error('ipc closed')
        }
      }
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })
})
