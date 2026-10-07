import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@test/render'
import { NO_KEY, SAVED_KEY } from '../testSupport'
import { ApiKeyForm, CANNOT_ENCRYPT, type ApiKeyFormProps } from './ApiKeyForm'

function setup(props: Partial<ApiKeyFormProps> = {}) {
  const handlers = {
    onKeyChange: vi.fn(),
    onReplace: vi.fn(),
    onKeepSaved: vi.fn(),
    onTest: vi.fn(),
    onModelChange: vi.fn()
  }
  const all: ApiKeyFormProps = {
    status: NO_KEY,
    keyValue: '',
    replacing: false,
    error: null,
    busy: false,
    outcome: null,
    ...handlers,
    ...props
  }
  return { ...renderWithApp(<ApiKeyForm {...all} />), ...handlers }
}

describe('ApiKeyForm without a saved key', () => {
  it('shows an empty masked field, a disabled Test button, no pill and the Opus choice', () => {
    setup({ autoFocus: true })
    const field = screen.getByLabelText('Claude API key')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Model')).toHaveValue('opus-5.5')
    expect(
      screen.getByText(
        'Stored encrypted on this computer and never shown again. You can replace it any time in Settings.'
      )
    ).toBeInTheDocument()
  })

  it('reports typing and toggles Show / Hide with aria-pressed', async () => {
    const { user, onKeyChange } = setup()
    await user.type(screen.getByLabelText('Claude API key'), 'a')
    expect(onKeyChange).toHaveBeenCalledWith('a')
    const show = screen.getByRole('button', { name: 'Show' })
    expect(show).toHaveAttribute('aria-pressed', 'false')
    await user.click(show)
    expect(screen.getByLabelText('Claude API key')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('tests with the button and with Enter in the field once a key is typed', async () => {
    const { user, onTest } = setup({ keyValue: 'sk-ant-abc' })
    await user.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(onTest).toHaveBeenCalledTimes(1)
    await user.type(screen.getByLabelText('Claude API key'), '{Enter}')
    expect(onTest).toHaveBeenCalledTimes(2)
  })

  it('ignores Enter while empty', async () => {
    const { user, onTest } = setup()
    await user.type(screen.getByLabelText('Claude API key'), '{Enter}')
    expect(onTest).not.toHaveBeenCalled()
  })

  it('shows a format error under the field with aria-invalid', () => {
    setup({ keyValue: 'abc', error: 'Claude API keys start with sk-ant-.' })
    expect(screen.getByLabelText('Claude API key')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Claude API keys start with sk-ant-.')).toBeInTheDocument()
  })

  it('disables the field, Test and the message when this computer cannot encrypt', () => {
    setup({ status: { ...NO_KEY, encryptionAvailable: false }, keyValue: 'sk-ant-abc' })
    expect(screen.getByLabelText('Claude API key')).toBeDisabled()
    expect(screen.getByText(CANNOT_ENCRYPT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled()
  })
})

describe('ApiKeyForm with a saved key', () => {
  it('shows the saved-key display with Replace, and no Show button or input', () => {
    setup({ status: SAVED_KEY })
    expect(screen.getByText('Saved key ending in WXYZ')).toBeInTheDocument()
    expect(document.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeEnabled()
  })

  it('Replace asks the parent to switch to replace mode', async () => {
    const { user, onReplace } = setup({ status: SAVED_KEY })
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    expect(onReplace).toHaveBeenCalled()
  })

  it('in replace mode shows a focused empty field and a way back', async () => {
    const { user, onKeepSaved } = setup({ status: SAVED_KEY, replacing: true })
    expect(screen.getByLabelText('Claude API key')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Keep the saved key' }))
    expect(onKeepSaved).toHaveBeenCalledTimes(1)
  })

  it('Esc in replace mode keeps the saved key', async () => {
    const { user, onKeepSaved } = setup({ status: SAVED_KEY, replacing: true })
    await user.type(screen.getByLabelText('Claude API key'), '{Escape}')
    expect(onKeepSaved).toHaveBeenCalled()
  })

  it('does not offer "Keep the saved key" when nothing is saved', () => {
    setup({ replacing: true })
    expect(screen.queryByRole('button', { name: 'Keep the saved key' })).not.toBeInTheDocument()
  })
})

describe('ApiKeyForm test result', () => {
  it('shows Connected in the done style', () => {
    setup({ status: SAVED_KEY, outcome: 'connected' })
    const pill = screen.getByRole('status')
    expect(pill).toHaveTextContent('Connected')
    expect(pill).toHaveAttribute('data-tone', 'done')
  })

  it('shows Checking… and locks Test and the model while busy', () => {
    setup({ status: SAVED_KEY, busy: true })
    expect(screen.getByRole('status')).toHaveTextContent('Checking…')
    const test = screen.getByRole('button', { name: 'Testing…' })
    expect(test).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Model')).toBeDisabled()
  })

  it.each([
    [
      'invalid-key',
      'Key not recognised',
      'Check you copied the whole key. It starts with sk-ant-.'
    ],
    ['network', 'Can’t reach Claude', 'Check your internet connection, then test again.'],
    ['rate-limited', 'Too many requests', 'Wait a minute, then test again.'],
    ['overloaded', 'Claude is busy', 'Claude is very busy right now. Try again in a minute.'],
    [
      'permission',
      'Not allowed',
      'This key isn’t allowed to use Claude. Check its workspace in the Claude Console.'
    ],
    ['unknown', 'Something went wrong', 'Try again. If it keeps happening, create a new key.']
  ] as const)('explains %s', (outcome, pill, helper) => {
    setup({ status: SAVED_KEY, outcome })
    expect(screen.getByRole('status')).toHaveTextContent(pill)
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'error')
    expect(screen.getByText(helper)).toBeInTheDocument()
  })

  it('links the Console when there is no credit', () => {
    setup({ status: SAVED_KEY, outcome: 'no-credit' })
    expect(screen.getByRole('status')).toHaveTextContent('No credit on this account')
    expect(
      screen.getByText(/Add credit in the Claude Console, then test again\./)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'platform.claude.com ↗' })).toHaveAttribute(
      'href',
      'https://platform.claude.com/'
    )
  })

  it('names the chosen model when it is unavailable', () => {
    setup({ status: { ...SAVED_KEY, model: 'sonnet-5.5' }, outcome: 'model-unavailable' })
    expect(
      screen.getByText(
        'This key can’t use Claude Sonnet 5.5. Choose the other model or check your Claude Console.'
      )
    ).toBeInTheDocument()
  })
})

describe('ApiKeyForm model', () => {
  it('offers the two models with the spec labels and reports a change', async () => {
    const { user, onModelChange } = setup({ status: SAVED_KEY })
    const select = screen.getByLabelText('Model')
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual([
      'Claude Opus 5.5 — best quality (recommended)',
      'Claude Sonnet 5.5 — faster and cheaper'
    ])
    await user.selectOptions(select, 'sonnet-5.5')
    expect(onModelChange).toHaveBeenCalledWith('sonnet-5.5')
  })
})
