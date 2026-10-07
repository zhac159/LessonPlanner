import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { createFakeClients, renderWithApp } from '@test/render'
import { useProfile } from '../hooks/useProfile'
import { SAVED_KEY, fakeSettings, type FakeSettingsOptions } from '../testSupport'
import { SettingsPage } from './SettingsPage'

const DONE = {
  name: 'Alice',
  subject: 'Science',
  onboarding: { step: 'done' as const, completedAt: 'x', skippedAi: false }
}

function Harness({ focusAiSignal = 0 }: { focusAiSignal?: number }) {
  const { loaded, profile, save } = useProfile()
  return loaded ? (
    <SettingsPage profile={profile} saveProfile={save} focusAiSignal={focusAiSignal} />
  ) : null
}

function setup(options: FakeSettingsOptions = {}, focusAiSignal = 0) {
  const settings = fakeSettings({ profile: DONE, ...options })
  const view = renderWithApp(<Harness focusAiSignal={focusAiSignal} />, {
    clients: createFakeClients({ settings })
  })
  return { ...view, settings }
}

const name = () => screen.findByLabelText('What should I call you?')

describe('SettingsPage layout', () => {
  it('shows the page title, About you and Claude, and none of the wizard controls', async () => {
    setup({ status: SAVED_KEY })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'About you' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Claude' })).toBeInTheDocument()
    expect(await screen.findByText('Saved key ending in WXYZ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next: your style/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: /Setup progress/ })).not.toBeInTheDocument()
  })

  it('shows this month’s usage', async () => {
    setup({ status: SAVED_KEY })
    expect(await screen.findByText('This month: about $1.23')).toBeInTheDocument()
  })

  it('leaves the usage line out when it cannot be read', async () => {
    setup({
      status: SAVED_KEY,
      overrides: {
        getUsage: () => {
          throw new Error('nope')
        }
      }
    })
    await screen.findByText('Saved key ending in WXYZ')
    expect(screen.queryByText(/This month/)).not.toBeInTheDocument()
  })

  it('moves focus to the Claude card when asked for the AI page', async () => {
    setup({ status: SAVED_KEY }, 1)
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Claude' })).toHaveFocus()
    )
  })
})

describe('SettingsPage profile', () => {
  it('shows the saved name and subject', async () => {
    setup()
    expect(await name()).toHaveValue('Alice')
    expect(screen.getByLabelText('What do you mostly teach?')).toHaveValue('Science')
  })

  it('saves a changed name when the field loses focus and refreshes the shell user', async () => {
    const { user, settings, shell } = setup()
    await user.clear(await name())
    await user.type(screen.getByLabelText('What should I call you?'), '  Bea ')
    await user.tab()
    await waitFor(() => expect(settings.setProfile).toHaveBeenCalledWith({ name: '  Bea ' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByLabelText('What should I call you?')).toHaveValue('Bea')
    expect(shell.refreshUser).toHaveBeenCalled()
  })

  it('saves with Enter and turns an emptied subject into null', async () => {
    const { user, settings } = setup()
    await screen.findByLabelText('What should I call you?')
    await user.clear(screen.getByLabelText('What do you mostly teach?'))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(settings.setProfile).toHaveBeenCalledWith({ subject: null }))
  })

  it('does not save when nothing changed', async () => {
    const { user, settings } = setup()
    await user.click(await name())
    await user.tab()
    await user.tab()
    expect(settings.setProfile).not.toHaveBeenCalled()
  })

  it('shows the message from main when the name is refused', async () => {
    const message = 'Add your name so I know what to call you.'
    const { user, shell } = setup({
      overrides: { setProfile: () => fail('invalid-input', message) }
    })
    await user.clear(await name())
    await user.tab()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('What should I call you?')).toHaveAttribute('aria-invalid', 'true')
    expect(shell.refreshUser).not.toHaveBeenCalled()
  })
})

describe('SettingsPage Claude', () => {
  it('shows an empty key field when no key is saved and no Remove key', async () => {
    setup()
    expect(await screen.findByLabelText('Claude API key')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument()
  })

  it('tests the saved key and shows Connected', async () => {
    const { user } = setup({ status: SAVED_KEY })
    await user.click(await screen.findByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('saves a model change at once and tests again', async () => {
    const { user, settings } = setup({ status: SAVED_KEY })
    await screen.findByText('Saved key ending in WXYZ')
    await user.selectOptions(screen.getByLabelText('Model'), 'sonnet-5.5')
    expect(settings.setModel).toHaveBeenCalledWith('sonnet-5.5')
    await waitFor(() => expect(settings.testConnection).toHaveBeenCalled())
  })

  it('asks before removing the key and does nothing on Cancel', async () => {
    const { user, settings } = setup({ status: SAVED_KEY })
    await user.click(await screen.findByRole('button', { name: 'Remove key' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove your API key?' })
    expect(
      within(dialog).getByText(
        'Slide Planner won’t be able to make or change slides until you add a key again.'
      )
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(settings.removeApiKey).not.toHaveBeenCalled()
    expect(screen.getByText('Saved key ending in WXYZ')).toBeInTheDocument()
  })

  it('removes the key after confirming and shows the empty form again', async () => {
    const { user, settings, shell } = setup({ status: SAVED_KEY })
    await user.click(await screen.findByRole('button', { name: 'Remove key' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove your API key?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove key' }))
    await waitFor(() => expect(settings.removeApiKey).toHaveBeenCalledTimes(1))
    expect(await screen.findByLabelText('Claude API key')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument()
    expect(shell.refreshUser).toHaveBeenCalled()
  })
})
