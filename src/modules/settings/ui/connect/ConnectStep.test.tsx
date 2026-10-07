import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { aiFailure } from '@shared/ai/errors'
import { fail } from '@shared/result'
import type { AiStatus } from '@shared/contracts/settings'
import { createFakeClients, renderWithApp } from '@test/render'
import { useConnectClaude } from '../hooks/useConnectClaude'
import { usePictureMaker } from '../hooks/usePictureMaker'
import { SAVED_KEY, TYPED_KEY, fakeSettings, type FakeSettingsOptions } from '../testSupport'
import { ConnectStep } from './ConnectStep'

function Harness(props: { onBack(): void; onSkip(): void; onContinue(): void }) {
  const claude = useConnectClaude()
  const picture = usePictureMaker()
  return <ConnectStep claude={claude} picture={picture} {...props} />
}

function setup(options: FakeSettingsOptions = {}) {
  const settings = fakeSettings(options)
  const clients = createFakeClients({ settings })
  const handlers = { onBack: vi.fn(), onSkip: vi.fn(), onContinue: vi.fn() }
  const view = renderWithApp(<Harness {...handlers} />, { clients })
  return { ...view, settings, clients, ...handlers }
}

const keyField = () => screen.findByLabelText('Claude API key')
const next = () => screen.getByRole('button', { name: /Next: your style|Continue anyway/ })

describe('ConnectStep first view', () => {
  it('shows the copy, the progress pills and a focused empty key field with Next disabled', async () => {
    setup()
    expect(await keyField()).toHaveFocus()
    expect(screen.getByRole('heading', { level: 1, name: 'Connect Claude' })).toBeInTheDocument()
    expect(screen.getByText(/Slide Planner uses Claude to read your old decks/)).toBeInTheDocument()
    expect(screen.getByText('Can I use my Claude Pro or Max subscription?')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Setup progress: step 2 of 3' })).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'How to get a key' })
    expect(steps).toHaveTextContent('Open the Claude Console')
    expect(steps).toHaveTextContent('Add credit and set a monthly limit there too')
    expect(steps).toHaveTextContent('Then test the connection')
    expect(next()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled()
    expect(screen.getAllByRole('link', { name: 'platform.claude.com ↗' })[0]).toHaveAttribute(
      'href',
      'https://platform.claude.com/'
    )
  })

  it('goes back to Welcome from the done "You" pill', async () => {
    const { user, onBack } = setup()
    await keyField()
    await user.click(screen.getByRole('button', { name: 'About you' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('Skip for now leaves without saving a typed key', async () => {
    const { user, onSkip, settings } = setup()
    await user.type(await keyField(), TYPED_KEY)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(onSkip).toHaveBeenCalled()
    expect(settings.setApiKey).not.toHaveBeenCalled()
  })
})

describe('ConnectStep testing a key', () => {
  it('saves, tests, shows Connected and replaces the field with the saved display', async () => {
    const { user, settings } = setup()
    await user.type(await keyField(), `  ${TYPED_KEY}  `)
    expect(next()).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Saved key ending in 1234')).toBeInTheDocument()
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(settings.setApiKey).toHaveBeenCalledWith(TYPED_KEY)
    expect(document.body.textContent).not.toContain('SECRETVALUE')
    expect(screen.queryByLabelText('Claude API key', { selector: 'input' })).toBeNull()
  })

  it('shows Checking… while the request runs and locks Next and the model', async () => {
    let finish: (value: ReturnType<typeof aiFailure>) => void = () => {}
    const { user } = setup({
      overrides: { testConnection: () => new Promise((resolve) => (finish = resolve)) }
    })
    await user.type(await keyField(), TYPED_KEY)
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(await screen.findByText('Checking…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Testing…' })).toHaveAttribute('aria-busy', 'true')
    expect(next()).toBeDisabled()
    expect(screen.getByLabelText('Model')).toBeDisabled()
    await act(async () => finish(aiFailure('network')))
    expect(await screen.findByText('Can’t reach Claude')).toBeInTheDocument()
  })

  it('Enter in the key field does the same as Test connection', async () => {
    const { user, settings } = setup()
    await user.type(await keyField(), `${TYPED_KEY}{Enter}`)
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(settings.testConnection).toHaveBeenCalledTimes(1)
  })

  it('shows a format error, saves nothing and runs no test', async () => {
    const message = 'Claude API keys start with sk-ant-.'
    const { user, settings } = setup({
      overrides: { setApiKey: () => fail('invalid-input', message) }
    })
    await user.type(await keyField(), 'hello{Enter}')
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Claude API key')).toHaveAttribute('aria-invalid', 'true')
    expect(settings.testConnection).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Claude API key')).toHaveValue('hello')
  })

  it('keeps the typed value and shows the message when saving fails (io)', async () => {
    const message = 'This computer can’t store the key securely, so it wasn’t saved.'
    const { user } = setup({ overrides: { setApiKey: () => fail('io', message) } })
    await user.type(await keyField(), `${TYPED_KEY}{Enter}`)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText('Claude API key')).toHaveValue(TYPED_KEY)
  })

  it('clears a format error as soon as the teacher edits the key', async () => {
    const { user } = setup({
      overrides: { setApiKey: () => fail('invalid-input', 'Claude API keys start with sk-ant-.') }
    })
    await user.type(await keyField(), 'x{Enter}')
    await screen.findByText('Claude API keys start with sk-ant-.')
    await user.type(screen.getByLabelText('Claude API key'), 'y')
    expect(screen.queryByText('Claude API keys start with sk-ant-.')).not.toBeInTheDocument()
  })

  it('reads an unexpected failure of the call as "Something went wrong"', async () => {
    const { user } = setup({
      overrides: {
        testConnection: () => {
          throw new Error('ipc closed')
        }
      }
    })
    await user.type(await keyField(), `${TYPED_KEY}{Enter}`)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})

describe('ConnectStep Next', () => {
  it('continues after a successful test of a typed key', async () => {
    const { user, onContinue } = setup()
    await user.type(await keyField(), TYPED_KEY)
    await user.click(next())
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1))
  })

  it.each(['invalid-key', 'permission'] as const)(
    'stays on %s and keeps its label',
    async (code) => {
      const { user, onContinue } = setup({ overrides: { testConnection: () => aiFailure(code) } })
      await user.type(await keyField(), TYPED_KEY)
      await user.click(next())
      await screen.findByRole('status')
      expect(onContinue).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Next: your style' })).toBeInTheDocument()
    }
  )

  it('stays on a format error', async () => {
    const { user, onContinue } = setup({
      overrides: { setApiKey: () => fail('invalid-input', 'Claude API keys start with sk-ant-.') }
    })
    await user.type(await keyField(), 'nope')
    await user.click(next())
    await screen.findByText('Claude API keys start with sk-ant-.')
    expect(onContinue).not.toHaveBeenCalled()
  })

  it.each([
    ['no-credit', 'No credit on this account'],
    ['network', 'Can’t reach Claude'],
    ['overloaded', 'Claude is busy']
  ] as const)('on %s stays, then offers "Continue anyway"', async (code, pill) => {
    const { user, onContinue } = setup({ overrides: { testConnection: () => aiFailure(code) } })
    await user.type(await keyField(), TYPED_KEY)
    await user.click(next())
    expect(await screen.findByText(pill)).toBeInTheDocument()
    expect(onContinue).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Continue anyway' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('continues at once for a saved key whose last test was connected', async () => {
    const status: Partial<AiStatus> = {
      ...SAVED_KEY,
      lastTest: { result: 'connected', at: '2026-10-05T10:00:00Z' }
    }
    const { user, onContinue, settings } = setup({ status })
    expect(await screen.findByText('Saved key ending in WXYZ')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    await user.click(next())
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(settings.testConnection).not.toHaveBeenCalled()
  })

  it('tests a saved key that was never tested before continuing', async () => {
    const { user, onContinue, settings } = setup({ status: SAVED_KEY })
    await screen.findByText('Saved key ending in WXYZ')
    await user.click(next())
    await waitFor(() => expect(onContinue).toHaveBeenCalled())
    expect(settings.testConnection).toHaveBeenCalledTimes(1)
  })

  it('offers "Continue anyway" straight away when the saved key last failed in a non-blocking way', async () => {
    const { user, onContinue } = setup({
      status: { ...SAVED_KEY, lastTest: { result: 'no-credit', at: '2026-10-05T10:00:00Z' } }
    })
    await user.click(await screen.findByRole('button', { name: 'Continue anyway' }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('is disabled while this computer cannot encrypt', async () => {
    setup({ status: { encryptionAvailable: false } })
    expect(await screen.findByLabelText('Claude API key')).toBeDisabled()
    expect(next()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled()
  })
})

describe('ConnectStep replace mode and model', () => {
  it('replaces a saved key and can go back to it with Esc or the link', async () => {
    const { user } = setup({ status: SAVED_KEY })
    await user.click(await screen.findByRole('button', { name: 'Replace' }))
    const field = screen.getByLabelText('Claude API key')
    expect(field).toHaveFocus()
    expect(field).toHaveValue('')
    await user.keyboard('{Escape}')
    expect(await screen.findByText('Saved key ending in WXYZ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    await user.click(screen.getByRole('button', { name: 'Keep the saved key' }))
    expect(screen.getByText('Saved key ending in WXYZ')).toBeInTheDocument()
  })

  it('saves a new key typed in replace mode and shows its last four', async () => {
    const { user, settings } = setup({ status: SAVED_KEY })
    await user.click(await screen.findByRole('button', { name: 'Replace' }))
    await user.type(screen.getByLabelText('Claude API key'), `${TYPED_KEY}{Enter}`)
    expect(await screen.findByText('Saved key ending in 1234')).toBeInTheDocument()
    expect(settings.setApiKey).toHaveBeenCalledWith(TYPED_KEY)
  })

  it('saves the model at once and re-runs the test when a key is saved', async () => {
    const { user, settings } = setup({
      status: { ...SAVED_KEY, lastTest: { result: 'connected', at: '2026-10-05T10:00:00Z' } }
    })
    await screen.findByText('Connected')
    await user.selectOptions(screen.getByLabelText('Model'), 'sonnet-5.5')
    expect(settings.setModel).toHaveBeenCalledWith('sonnet-5.5')
    await waitFor(() => expect(settings.testConnection).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Model')).toHaveValue('sonnet-5.5')
    expect(await screen.findByText('Connected')).toBeInTheDocument()
  })

  it('saves the model without testing when no key is saved', async () => {
    const { user, settings } = setup()
    await keyField()
    await user.selectOptions(screen.getByLabelText('Model'), 'sonnet-5.5')
    expect(settings.setModel).toHaveBeenCalledWith('sonnet-5.5')
    expect(settings.testConnection).not.toHaveBeenCalled()
  })

  it('follows aiStatusChanged events from elsewhere', async () => {
    const { clients } = setup({ status: SAVED_KEY })
    await screen.findByText('Saved key ending in WXYZ')
    act(() =>
      clients.emit('settings', 'aiStatusChanged', {
        hasKey: false,
        keyLast4: null,
        model: 'opus-5.5',
        lastTest: null,
        encryptionAvailable: true
      })
    )
    expect(await screen.findByLabelText('Claude API key')).toBeInTheDocument()
  })
})
