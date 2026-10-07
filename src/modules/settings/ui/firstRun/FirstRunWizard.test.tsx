import { screen, waitFor } from '@testing-library/react'
import { Palette } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import type { UiModule } from '@renderer/sdk'
import { fail } from '@shared/result'
import { createFakeClients, renderWithApp } from '@test/render'
import { TYPED_KEY, fakeSettings, type FakeSettingsOptions } from '../testSupport'
import { useProfile } from '../hooks/useProfile'
import { FirstRunWizard } from './FirstRunWizard'

const stub = (id: string): UiModule => ({ id, title: id, icon: Palette, component: () => null })

function Harness({ onDone }: { onDone(): void }) {
  const { loaded, profile, save } = useProfile()
  return loaded ? <FirstRunWizard profile={profile} saveProfile={save} onDone={onDone} /> : null
}

function setup(options: FakeSettingsOptions = {}, modules = [stub('home'), stub('style-library')]) {
  const settings = fakeSettings(options)
  const onDone = vi.fn()
  const view = renderWithApp(<Harness onDone={onDone} />, {
    clients: createFakeClients({ settings }),
    shell: { modules }
  })
  return { ...view, settings, onDone }
}

const nameField = () => screen.findByLabelText('What should I call you?')

describe('FirstRunWizard step 1', () => {
  it('starts on Welcome with the default name', async () => {
    setup()
    expect(await nameField()).toHaveValue('Alice')
    expect(screen.getByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
  })

  it('prefills a name that was saved earlier', async () => {
    setup({ profile: { name: 'Ms Patel', subject: 'Science' } })
    expect(await nameField()).toHaveValue('Ms Patel')
    expect(screen.getByLabelText('What do you mostly teach?')).toHaveValue('Science')
  })

  it('saves the profile, moves the saved step on and shows Connect Claude', async () => {
    const { user, settings } = setup()
    await user.clear(await nameField())
    await user.type(screen.getByLabelText('What should I call you?'), 'Bea')
    await user.type(screen.getByLabelText('What do you mostly teach?'), 'Art')
    await user.click(screen.getByRole('button', { name: 'Next: connect Claude' }))
    expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeInTheDocument()
    expect(settings.setProfile).toHaveBeenCalledWith({ name: 'Bea', subject: 'Art' })
    expect(settings.setOnboardingStep).toHaveBeenCalledWith('connect')
  })

  it('saves an empty subject as null', async () => {
    const { user, settings } = setup()
    await nameField()
    await user.click(screen.getByRole('button', { name: 'Next: connect Claude' }))
    await screen.findByRole('heading', { name: 'Connect Claude' })
    expect(settings.setProfile).toHaveBeenCalledWith({ name: 'Alice', subject: null })
  })

  it('stays on Welcome with an error when the profile cannot be saved', async () => {
    const { user, settings } = setup({
      overrides: { setProfile: () => fail('io', 'disk full') }
    })
    await nameField()
    await user.click(screen.getByRole('button', { name: 'Next: connect Claude' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that. Try again.')
    expect(settings.setOnboardingStep).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
  })

  it('stays on Welcome when the call itself fails', async () => {
    const { user } = setup({
      overrides: {
        setOnboardingStep: () => {
          throw new Error('ipc closed')
        }
      }
    })
    await nameField()
    await user.click(screen.getByRole('button', { name: 'Next: connect Claude' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that. Try again.')
  })
})

describe('FirstRunWizard step 2', () => {
  it('resumes at Connect Claude when that was the saved step', async () => {
    setup({
      profile: { name: 'Bea', onboarding: { step: 'connect', completedAt: null, skippedAi: false } }
    })
    expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Welcome!' })).not.toBeInTheDocument()
  })

  it('goes back to Welcome with the saved values kept', async () => {
    const { user } = setup()
    await user.clear(await nameField())
    await user.type(screen.getByLabelText('What should I call you?'), 'Bea')
    await user.click(screen.getByRole('button', { name: 'Next: connect Claude' }))
    await user.click(await screen.findByRole('button', { name: 'About you' }))
    expect(await nameField()).toHaveValue('Bea')
  })

  it('Skip for now completes onboarding as skipped and goes Home', async () => {
    const { user, settings, shell, onDone } = setup({
      profile: { name: 'Bea', onboarding: { step: 'connect', completedAt: null, skippedAi: false } }
    })
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(shell.navigate).toHaveBeenCalledWith('home'))
    expect(settings.completeOnboarding).toHaveBeenCalledWith({ skippedAi: true })
    expect(shell.refreshUser).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('Next: your style completes onboarding and opens Create a style', async () => {
    const { user, settings, shell, onDone } = setup({
      profile: { name: 'Bea', onboarding: { step: 'connect', completedAt: null, skippedAi: false } }
    })
    await user.type(await screen.findByLabelText('Claude API key'), TYPED_KEY)
    await user.click(screen.getByRole('button', { name: 'Next: your style' }))
    await waitFor(() =>
      expect(shell.navigate).toHaveBeenCalledWith('style-library', {
        kind: 'new-style',
        firstRun: true
      })
    )
    expect(settings.completeOnboarding).toHaveBeenCalledWith({ skippedAi: false })
    expect(shell.refreshUser).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })

  it('goes Home when there is no style module to open', async () => {
    const { user, shell } = setup(
      {
        profile: {
          name: 'Bea',
          onboarding: { step: 'connect', completedAt: null, skippedAi: false }
        },
        status: { hasKey: true, keyLast4: 'WXYZ', lastTest: { result: 'connected', at: 'x' } }
      },
      [stub('home')]
    )
    await user.click(await screen.findByRole('button', { name: 'Next: your style' }))
    await waitFor(() => expect(shell.navigate).toHaveBeenCalledWith('home'))
  })

  it('stays put and shows a toast when onboarding cannot be completed', async () => {
    const { user, shell, onDone } = setup({
      profile: {
        name: 'Bea',
        onboarding: { step: 'connect', completedAt: null, skippedAi: false }
      },
      overrides: {
        completeOnboarding: () => {
          throw new Error('disk full')
        }
      }
    })
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    expect(await screen.findByText('Couldn’t save that. Try again.')).toBeInTheDocument()
    expect(shell.navigate).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
