import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fail } from '@shared/result'
import { createFakeClients, renderWithApp } from '@test/render'
import { useProfile } from '../hooks/useProfile'
import {
  SAVED_KEY,
  SAVED_PICTURE_MAKER,
  TYPED_GOOGLE_KEY,
  fakeSettings,
  type FakeSettingsOptions
} from '../testSupport'
import { SettingsPage } from './SettingsPage'

const DONE = {
  name: 'Alice',
  subject: 'Science',
  onboarding: { step: 'done' as const, completedAt: 'x', skippedAi: false }
}

function Harness() {
  const { loaded, profile, save } = useProfile()
  return loaded ? <SettingsPage profile={profile} saveProfile={save} focusAiSignal={0} /> : null
}

function setup(options: FakeSettingsOptions = {}) {
  const settings = fakeSettings({ profile: DONE, status: SAVED_KEY, ...options })
  const view = renderWithApp(<Harness />, { clients: createFakeClients({ settings }) })
  return { ...view, settings }
}

const region = () => screen.findByRole('region', { name: 'Add a picture maker' })

describe('Settings › AI picture maker', () => {
  it('sits in the Claude card with no Skip link and no model choice before a key', async () => {
    setup()
    const section = await region()
    expect(within(section).getByLabelText('Google AI Studio API key')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument()
    expect(within(section).queryByLabelText('Picture maker model')).not.toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument()
  })

  it('shows a skipped choice fully open (Settings is where it can be added)', async () => {
    setup({ picture: { skipped: true } })
    expect(within(await region()).getByLabelText('Google AI Studio API key')).toBeInTheDocument()
  })

  it('adds a key and tests it; the model choice appears with the saved key', async () => {
    const { user, settings } = setup()
    const section = await region()
    await user.type(within(section).getByLabelText('Google AI Studio API key'), TYPED_GOOGLE_KEY)
    await user.click(within(section).getByRole('button', { name: 'Test picture maker' }))
    expect(await within(section).findByText('Saved key ending in 3456')).toBeInTheDocument()
    expect(within(section).getByRole('status')).toHaveTextContent('Connected')
    expect(settings.testPictureMaker).toHaveBeenCalledTimes(1)
    expect(within(section).getByLabelText('Picture maker model')).toHaveValue('gemini-3-pro-image')
    expect(within(section).getByText('About $0.13 a picture')).toBeInTheDocument()
  })

  it('saves the other model, shows its price and checks the key again (the check is free)', async () => {
    const { user, settings } = setup({ picture: SAVED_PICTURE_MAKER })
    const section = await region()
    await user.selectOptions(
      within(section).getByLabelText('Picture maker model'),
      'gemini-nano-banana-2.1'
    )
    expect(settings.setPictureMakerModel).toHaveBeenCalledWith('gemini-nano-banana-2.1')
    expect(await within(section).findByText('About $0.05 a picture')).toBeInTheDocument()
    await waitFor(() => expect(settings.testPictureMaker).toHaveBeenCalledTimes(1))
    expect(await within(section).findByRole('status')).toHaveTextContent('Connected')
  })

  it('lets the teacher switch model when the chosen one is not on the key', async () => {
    const { user } = setup({
      picture: { ...SAVED_PICTURE_MAKER, lastTest: { result: 'model-unavailable', at: 'x' } }
    })
    const section = await region()
    expect(
      await within(section).findByText('That picture maker isn’t available on this key.')
    ).toBeInTheDocument()
    expect(within(section).getByLabelText('Picture maker model')).toBeEnabled()
    await user.selectOptions(
      within(section).getByLabelText('Picture maker model'),
      'gemini-nano-banana-2.1'
    )
  })

  it('removes only the picture-maker key after confirming, leaving Claude connected', async () => {
    const { user, settings } = setup({ picture: SAVED_PICTURE_MAKER })
    const section = await region()
    await user.click(within(section).getByRole('button', { name: 'Remove key' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove the picture maker key?' })
    await user.click(within(dialog).getByRole('button', { name: 'Remove key' }))
    await waitFor(() => expect(settings.removePictureMakerKey).toHaveBeenCalledTimes(1))
    expect(settings.removeApiKey).not.toHaveBeenCalled()
    expect(
      await within(await region()).findByLabelText('Google AI Studio API key')
    ).toBeInTheDocument()
    expect(screen.getByText('Saved key ending in WXYZ')).toBeInTheDocument()
  })

  it('shows the refusal for a key that does not look like a Google key', async () => {
    const { user } = setup({
      overrides: {
        setPictureMakerKey: () =>
          fail('invalid-input', 'That doesn’t look like a Google key. They start with AIza.')
      }
    })
    const section = await region()
    await user.type(within(section).getByLabelText('Google AI Studio API key'), 'sk-ant-xyz')
    await user.click(within(section).getByRole('button', { name: 'Test picture maker' }))
    expect(await within(section).findByText(/They start with AIza/)).toBeInTheDocument()
  })
})
