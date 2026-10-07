import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PictureMakerStatus } from '@shared/contracts/settings'
import { fail } from '@shared/result'
import { createFakeClients, renderWithApp } from '@test/render'
import { useConnectClaude } from '../hooks/useConnectClaude'
import { usePictureMaker } from '../hooks/usePictureMaker'
import {
  NO_PICTURE_MAKER,
  SAVED_KEY,
  SAVED_PICTURE_MAKER,
  TYPED_GOOGLE_KEY,
  fakeSettings,
  type FakeSettingsOptions
} from '../testSupport'
import { ConnectStep } from './ConnectStep'
import { SKIPPED_LINE } from './PictureMakerSection'

function Harness(props: { onBack(): void; onSkip(): void; onContinue(): void }) {
  const claude = useConnectClaude()
  const picture = usePictureMaker()
  return <ConnectStep claude={claude} picture={picture} {...props} />
}

function setup(options: FakeSettingsOptions = {}) {
  const settings = fakeSettings({ status: SAVED_KEY, ...options })
  const clients = createFakeClients({ settings })
  const handlers = { onBack: vi.fn(), onSkip: vi.fn(), onContinue: vi.fn() }
  const view = renderWithApp(<Harness {...handlers} />, { clients })
  return { ...view, settings, clients, ...handlers }
}

const FIELD = 'Google AI Studio API key'
const field = () => screen.findByLabelText(FIELD)
const region = () => screen.getByRole('region', { name: 'Add a picture maker' })
const section = () => screen.findByRole('region', { name: 'Add a picture maker' })
const testButton = () => within(region()).getByRole('button', { name: 'Test picture maker' })
const next = () => screen.getByRole('button', { name: /Next: your style|Continue anyway/ })

describe('first run: Add a picture maker', () => {
  it('sits under the model choice, empty, optional and not blocking Next', async () => {
    setup()
    expect(await field()).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Model')).toBeInTheDocument()
    expect(next()).toBeEnabled()
    expect(testButton()).toBeDisabled()
  })

  it('saves the typed key, runs the free check and shows Connected with the key hidden', async () => {
    const { user, settings } = setup()
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(testButton())
    expect(await within(region()).findByText('Saved key ending in 3456')).toBeInTheDocument()
    expect(await within(region()).findByRole('status')).toHaveTextContent('Connected')
    expect(settings.setPictureMakerKey).toHaveBeenCalledWith(TYPED_GOOGLE_KEY)
    expect(settings.testPictureMaker).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toContain('SECRETSECRET')
    expect(screen.queryByLabelText(FIELD, { selector: 'input' })).toBeNull()
  })

  it('tests with Enter in the field', async () => {
    const { user, settings } = setup()
    await user.type(await field(), `${TYPED_GOOGLE_KEY}{Enter}`)
    await waitFor(() => expect(settings.testPictureMaker).toHaveBeenCalledTimes(1))
  })

  it('shows the format message from main and keeps the typed text for fixing', async () => {
    const { user, settings } = setup()
    await user.type(await field(), 'sk-ant-api03-wrong')
    await user.click(testButton())
    expect(await screen.findByText(/They start with AIza/)).toBeInTheDocument()
    expect(settings.testPictureMaker).not.toHaveBeenCalled()
    expect(screen.getByLabelText(FIELD)).toHaveValue('sk-ant-api03-wrong')
  })

  it.each([
    ['invalid-key', 'Google didn’t accept that key.'],
    ['no-credit', /have no credit|has no credit/],
    ['rate-limited', 'Google is busy. Try again in a minute.'],
    ['network', 'Couldn’t reach Google. Check your internet.'],
    ['model-unavailable', 'That picture maker isn’t available on this key.']
  ] as const)('shows the message for a %s failure', async (code, message) => {
    const { user } = setup({
      overrides: { testPictureMaker: () => fail(code, 'raw message from main') }
    })
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(testButton())
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText('raw message from main')).not.toBeInTheDocument()
  })

  it('shows Checking… while the request runs and locks Next', async () => {
    let finish: (value: ReturnType<typeof fail>) => void = () => {}
    const { user } = setup({
      overrides: { testPictureMaker: () => new Promise((resolve) => (finish = resolve)) }
    })
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(testButton())
    expect(await within(region()).findByText('Checking…')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await act(async () => finish(fail('network', 'x')))
    expect(
      await screen.findByText('Couldn’t reach Google. Check your internet.')
    ).toBeInTheDocument()
    expect(next()).toBeEnabled()
  })

  it('treats an unexpected throw from main as a generic failure', async () => {
    const { user } = setup({
      overrides: {
        testPictureMaker: () => {
          throw new Error('boom')
        }
      }
    })
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(testButton())
    expect(await within(region()).findByRole('status')).toHaveTextContent('Something went wrong')
  })

  it('"Skip — I’ll add it later" records skipped and folds into one line, which can be reopened', async () => {
    const { user, settings } = setup()
    await user.type(await field(), 'AIzaPartial')
    await user.click(screen.getByRole('button', { name: 'Skip — I’ll add it later' }))
    expect(await screen.findByText(SKIPPED_LINE, { exact: false })).toBeInTheDocument()
    expect(settings.skipPictureMaker).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('region', { name: 'Add a picture maker' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add it now' }))
    expect(await field()).toHaveValue('')
  })

  it('starts folded when the choice was skipped earlier', async () => {
    setup({ picture: { skipped: true } })
    expect(await screen.findByText(SKIPPED_LINE, { exact: false })).toBeInTheDocument()
  })

  it('"Next: your style" saves an untested typed key without testing it, then continues', async () => {
    const { user, settings, onContinue } = setup()
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(next())
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1))
    expect(settings.setPictureMakerKey).toHaveBeenCalledWith(TYPED_GOOGLE_KEY)
    expect(settings.testPictureMaker).not.toHaveBeenCalled()
  })

  it('"Next: your style" works with the section left alone and saves nothing', async () => {
    const { user, settings, onContinue } = setup()
    await field()
    await user.click(next())
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1))
    expect(settings.setPictureMakerKey).not.toHaveBeenCalled()
  })

  it('stays on the page when the typed picture-maker key is refused', async () => {
    const { user, onContinue } = setup()
    await user.type(await field(), 'not-a-key')
    await user.click(next())
    expect(await screen.findByText(/They start with AIza/)).toBeInTheDocument()
    expect(onContinue).not.toHaveBeenCalled()
  })

  it('"Skip for now" leaves without saving a typed picture-maker key', async () => {
    const { user, settings, onSkip } = setup()
    await user.type(await field(), TYPED_GOOGLE_KEY)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(settings.setPictureMakerKey).not.toHaveBeenCalled()
  })

  it('shows a saved key as its last four with Replace, and Replace opens an empty field', async () => {
    const { user } = setup({ picture: SAVED_PICTURE_MAKER })
    await section()
    expect(await within(region()).findByText('Saved key ending in cdef')).toBeInTheDocument()
    await user.click(within(region()).getByRole('button', { name: 'Replace' }))
    expect(await field()).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Keep the saved key' }))
    expect(await within(region()).findByText('Saved key ending in cdef')).toBeInTheDocument()
  })

  it('shows the stored last check on a reopened screen', async () => {
    setup({
      picture: { ...SAVED_PICTURE_MAKER, lastTest: { result: 'invalid-key', at: 'x' } }
    })
    expect(await screen.findByText('Google didn’t accept that key.')).toBeInTheDocument()
  })

  it('follows pictureMakerStatusChanged events from elsewhere', async () => {
    const { clients } = setup({ picture: SAVED_PICTURE_MAKER })
    await section()
    await within(region()).findByText('Saved key ending in cdef')
    const empty: PictureMakerStatus = { ...NO_PICTURE_MAKER }
    act(() => clients.emit('settings', 'pictureMakerStatusChanged', empty))
    expect(await field()).toBeInTheDocument()
  })

  it('leaves the Claude controls alone: Claude still has its own key field and test', async () => {
    setup({ status: { hasKey: false } })
    expect(await screen.findByLabelText('Claude API key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeInTheDocument()
  })
})
