import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithApp } from '@test/render'
import { NO_PICTURE_MAKER, SAVED_PICTURE_MAKER } from '../testSupport'
import {
  AI_STUDIO_URL,
  DISCLOSURE,
  PictureMakerSection,
  SKIPPED_LINE,
  type PictureMakerSectionProps
} from './PictureMakerSection'
import { FREE_TEST_NOTE } from './pictureOutcome'

const handlers = () => ({
  onKeyChange: vi.fn(),
  onReplace: vi.fn(),
  onKeepSaved: vi.fn(),
  onReopen: vi.fn(),
  onTest: vi.fn(),
  onSkip: vi.fn(),
  onRemove: vi.fn(async () => {}),
  onModelChange: vi.fn()
})

function propsOf(over: Partial<PictureMakerSectionProps> = {}, fns = handlers()) {
  const props: PictureMakerSectionProps = {
    mode: 'first-run',
    status: NO_PICTURE_MAKER,
    keyValue: '',
    replacing: false,
    error: null,
    busy: false,
    outcome: null,
    collapsed: false,
    ...fns,
    ...over
  }
  return { props, fns }
}

function setup(over: Partial<PictureMakerSectionProps> = {}) {
  const { props, fns } = propsOf(over)
  return { ...renderWithApp(<PictureMakerSection {...props} />), ...fns }
}

const FIELD = 'Google AI Studio API key'

describe('PictureMakerSection first run, no key', () => {
  it('shows the A7 copy: title, Optional pill, lead, helper with the link, disclosure', () => {
    setup()
    const region = screen.getByRole('region', { name: 'Add a picture maker' })
    expect(within(region).getByText('Optional')).toBeInTheDocument()
    expect(region).toHaveTextContent(
      'Google’s Nano Banana Pro makes new pictures in your style when you use “Make a new one like these” on the Assets page. Without it, Claude draws simple icons and diagrams instead.'
    )
    expect(region).toHaveTextContent(
      'Google bills it per picture. Stored encrypted on this computer, like your Claude key.'
    )
    expect(screen.getByRole('link', { name: 'aistudio.google.com ↗' })).toHaveAttribute(
      'href',
      AI_STUDIO_URL
    )
    expect(screen.getByText(DISCLOSURE)).toBeInTheDocument()
    expect(screen.getByText(FREE_TEST_NOTE)).toBeInTheDocument()
  })

  it('has a masked key field with Show / Hide, a disabled Test button and a Skip link', async () => {
    const { user } = setup()
    expect(screen.getByLabelText(FIELD)).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Test picture maker' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Skip — I’ll add it later' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText(FIELD)).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide' }))
    expect(screen.getByLabelText(FIELD)).toHaveAttribute('type', 'password')
  })

  it('has no model choice and no Remove link on first run', () => {
    setup({ status: SAVED_PICTURE_MAKER })
    expect(screen.queryByLabelText('Picture maker model')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument()
  })

  it('reports typing, tests with the button and with Enter, and skips', async () => {
    const { user, onKeyChange, onTest, onSkip } = setup({ keyValue: 'AIzaX' })
    await user.type(screen.getByLabelText(FIELD), 'a')
    expect(onKeyChange).toHaveBeenCalledWith('AIzaXa')
    await user.click(screen.getByRole('button', { name: 'Test picture maker' }))
    await user.type(screen.getByLabelText(FIELD), '{Enter}')
    expect(onTest).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Skip — I’ll add it later' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('shows the format error under the field', () => {
    setup({ keyValue: 'nope', error: 'That doesn’t look like a Google key. They start with AIza.' })
    expect(screen.getByLabelText(FIELD)).toBeInvalid()
    expect(screen.getByText(/They start with AIza/)).toBeInTheDocument()
  })

  it('disables the field and the test when this computer cannot encrypt', () => {
    setup({ status: { ...NO_PICTURE_MAKER, encryptionAvailable: false }, keyValue: 'AIzaX' })
    expect(screen.getByLabelText(FIELD)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Test picture maker' })).toBeDisabled()
    expect(screen.getByText(/can’t store the key securely/)).toBeInTheDocument()
  })
})

describe('PictureMakerSection states', () => {
  it('shows Checking… and locks Skip while busy', () => {
    setup({ busy: true, keyValue: 'AIzaX' })
    expect(screen.getByRole('status')).toHaveTextContent('Checking…')
    expect(screen.getByRole('button', { name: 'Skip — I’ll add it later' })).toBeDisabled()
  })

  it('shows a Connected pill with no error line', () => {
    setup({ status: SAVED_PICTURE_MAKER, outcome: 'connected' })
    expect(screen.getByRole('status')).toHaveTextContent('Connected')
    expect(screen.queryByText(/Google didn’t accept/)).not.toBeInTheDocument()
  })

  it.each([
    ['invalid-key', 'Key not accepted', 'Google didn’t accept that key.'],
    ['no-credit', 'No credit', /Picture makers need a paid Google project \(a \$5 top-up\)/],
    ['rate-limited', 'Google is busy', 'Google is busy. Try again in a minute.'],
    ['network', 'Can’t reach Google', 'Couldn’t reach Google. Check your internet.'],
    ['model-unavailable', 'Not on this key', 'That picture maker isn’t available on this key.']
  ] as const)('shows the %s message', (outcome, pill, helper) => {
    setup({ status: SAVED_PICTURE_MAKER, outcome })
    expect(screen.getByRole('status')).toHaveTextContent(pill)
    expect(screen.getByText(helper)).toBeInTheDocument()
  })

  it('shows only the end of a saved key and Replace; typing mode offers to keep it', async () => {
    const first = propsOf({ status: SAVED_PICTURE_MAKER })
    const { user, rerender } = renderWithApp(<PictureMakerSection {...first.props} />)
    expect(screen.getByText('Saved key ending in cdef')).toBeInTheDocument()
    expect(screen.queryByLabelText(FIELD, { selector: 'input' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    expect(first.fns.onReplace).toHaveBeenCalledTimes(1)
    rerender(<PictureMakerSection {...first.props} replacing />)
    await user.click(screen.getByRole('button', { name: 'Keep the saved key' }))
    expect(first.fns.onKeepSaved).toHaveBeenCalledTimes(1)
  })

  it('collapses to the skipped line after Skip, with a way back', async () => {
    const { user, onReopen } = setup({
      collapsed: true,
      status: { ...NO_PICTURE_MAKER, skipped: true }
    })
    expect(screen.getByText(SKIPPED_LINE, { exact: false })).toBeInTheDocument()
    expect(screen.queryByLabelText(FIELD)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add it now' }))
    expect(onReopen).toHaveBeenCalledTimes(1)
  })
})

describe('PictureMakerSection in Settings', () => {
  it('never collapses and has no Skip link', () => {
    setup({ mode: 'settings', collapsed: true })
    expect(screen.getByLabelText(FIELD)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Skip/ })).not.toBeInTheDocument()
  })

  it('offers the model choice with the price note once a key is saved', async () => {
    const { user, onModelChange } = setup({
      mode: 'settings',
      status: SAVED_PICTURE_MAKER,
      outcome: 'connected'
    })
    const select = screen.getByLabelText('Picture maker model')
    expect(select).toHaveValue('gemini-3-pro-image')
    expect(
      screen.getByRole('option', { name: 'Nano Banana Pro — best quality (recommended)' })
    ).toBeInTheDocument()
    expect(screen.getByText('About $0.13 a picture')).toBeInTheDocument()
    await user.selectOptions(select, 'gemini-nano-banana-2.1')
    expect(onModelChange).toHaveBeenCalledWith('gemini-nano-banana-2.1')
  })

  it('shows the cheaper model note', () => {
    setup({
      mode: 'settings',
      status: { ...SAVED_PICTURE_MAKER, model: 'gemini-nano-banana-2.1' }
    })
    expect(screen.getByText('About $0.05 a picture')).toBeInTheDocument()
  })

  it('hides the model choice and Remove while there is no key', () => {
    setup({ mode: 'settings' })
    expect(screen.queryByLabelText('Picture maker model')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove key' })).not.toBeInTheDocument()
  })

  it('asks before removing the key, and removes only after the confirmation', async () => {
    const { user, onRemove } = setup({ mode: 'settings', status: SAVED_PICTURE_MAKER })
    await user.click(screen.getByRole('button', { name: 'Remove key' }))
    const dialog = await screen.findByRole('dialog')
    expect(onRemove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onRemove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove key' }))
    const again = await screen.findByRole('dialog')
    await user.click(within(again).getByRole('button', { name: 'Remove key' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
