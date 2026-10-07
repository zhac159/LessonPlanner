import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginInput, PluginManifestView } from '@shared/contracts/deck-builder-plugins'
import { EIGHT_SLIDES, QUIZ_MANIFEST } from '../fixtures'
import { PluginSheet, type PluginSheetProps } from './PluginSheet'

function setup(props: Partial<PluginSheetProps> = {}) {
  const handlers = { onSubmit: vi.fn(), onBack: vi.fn(), onCancel: vi.fn(), onConnect: vi.fn() }
  const user = userEvent.setup()
  const merged: PluginSheetProps = {
    manifest: QUIZ_MANIFEST,
    slides: EIGHT_SLIDES,
    ...handlers,
    ...props
  }
  const utils = render(<PluginSheet {...merged} />)
  return { user, ...handlers, ...utils, merged }
}

const make = () => screen.getByRole('button', { name: 'Make quiz' })
const withInputs = (inputs: PluginInput[], extra: Partial<PluginManifestView> = {}) => ({
  ...QUIZ_MANIFEST,
  inputs,
  ...extra
})

describe('PluginSheet structure', () => {
  it('is a non-modal dialog named by the manifest title', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Quiz from slides' })
    expect(dialog).toHaveAttribute('aria-modal', 'false')
    expect(screen.getByText('Quick-check questions in your format')).toBeInTheDocument()
  })

  it('focuses the title on opening', () => {
    setup()
    expect(screen.getByText('Quiz from slides')).toHaveFocus()
  })

  it('generates the form from the manifest: fieldsets, stepper, checkboxes, pills, cards', () => {
    setup()
    expect(screen.getByRole('group', { name: 'Which slides?' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'How many questions?' })).toHaveValue(10)
    expect(screen.getByRole('group', { name: 'Question types' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Difficulty' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Where should it go?' })).toBeInTheDocument()
  })

  it('shows the estimate under the footer and the action as the Make label', () => {
    setup()
    expect(screen.getByText('About 20 seconds')).toBeInTheDocument()
    expect(make()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('labels the Make button from another manifest action', () => {
    setup({ manifest: withInputs([], { action: 'Write notes' }) })
    expect(screen.getByRole('button', { name: 'Write notes' })).toBeInTheDocument()
  })

  it('has the tab order Back, fields, Cancel, Make', async () => {
    const { user } = setup({ manifest: withInputs([QUIZ_MANIFEST.inputs[3]]) })
    // Focus starts on the title; Shift+Tab reaches Back, the first stop of the tab order.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Back to chat' })).toHaveFocus()
    await user.tab()
    expect(screen.getByText('Quiz from slides')).not.toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Mixed' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.tab()
    expect(make()).toHaveFocus()
  })
})

describe('PluginSheet defaults and slide range', () => {
  it('starts on the manifest defaults', () => {
    setup()
    expect(screen.getByRole('radio', { name: 'All 8 slides' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Mixed' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Multiple choice' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'True or false' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Short answer' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Slides at the end of this lesson/ })).toBeChecked()
  })

  it('starts on the last-used values', () => {
    setup({ lastInputs: { count: 14, difficulty: 'core', destination: 'both' } })
    expect(screen.getByRole('spinbutton')).toHaveValue(14)
    expect(screen.getByRole('radio', { name: 'Core' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Both' })).toBeChecked()
  })

  it('offers only All and Just slide k for a single selected slide', () => {
    setup()
    const group = screen.getByRole('group', { name: 'Which slides?' })
    expect(
      within(group)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent)
    ).toEqual(['All 8 slides', 'Just slide 3'])
  })

  it('shows and selects the range option for a multi-selection', () => {
    setup({ slides: { total: 8, current: 3, selected: [3, 4, 5, 6, 7] } })
    expect(screen.getByRole('radio', { name: 'Slides 3–7' })).toBeChecked()
  })

  it('follows the filmstrip while open', () => {
    const { rerender, merged } = setup()
    expect(screen.queryByRole('radio', { name: 'Slides 3–7' })).not.toBeInTheDocument()
    rerender(
      <PluginSheet {...merged} slides={{ total: 8, current: 3, selected: [3, 4, 5, 6, 7] }} />
    )
    expect(screen.getByRole('radio', { name: 'Slides 3–7' })).toBeChecked()
    rerender(<PluginSheet {...merged} />)
    expect(screen.queryByRole('radio', { name: 'Slides 3–7' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'All 8 slides' })).toBeChecked()
  })

  it('shows one pill in a one-slide lesson', () => {
    setup({ slides: { total: 1, current: 1, selected: [1] } })
    const group = screen.getByRole('group', { name: 'Which slides?' })
    expect(within(group).getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'Just slide 1' })).toBeChecked()
  })
})

describe('PluginSheet submitting', () => {
  it('submits the edited values with Make', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: 'Just slide 3' }))
    await user.click(screen.getByRole('button', { name: 'More questions' }))
    await user.click(screen.getByRole('checkbox', { name: 'Short answer' }))
    await user.click(screen.getByRole('radio', { name: 'Stretch' }))
    await user.click(screen.getByRole('radio', { name: /Printable quiz/ }))
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith({
      slides: 'current',
      count: 11,
      types: ['multiple-choice', 'true-false', 'short-answer'],
      difficulty: 'stretch',
      destination: 'word'
    })
  })

  it('submits with Ctrl+Enter from any field', async () => {
    const { user, onSubmit } = setup()
    screen.getByRole('radio', { name: 'Core' }).focus()
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit on a plain Enter in a field', async () => {
    const { user, onSubmit } = setup({
      manifest: withInputs([{ id: 'note', type: 'text', label: 'Extra instructions' }])
    })
    await user.type(screen.getByRole('textbox', { name: 'Extra instructions' }), 'hi{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('is disabled until the form is valid and does not run when invalid', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('checkbox', { name: 'Multiple choice' }))
    await user.click(screen.getByRole('checkbox', { name: 'True or false' }))
    expect(make()).toHaveAttribute('aria-disabled', 'true')
    await user.click(make())
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the multi error, marks the group invalid, and focuses it on Ctrl+Enter', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('checkbox', { name: 'Multiple choice' }))
    await user.click(screen.getByRole('checkbox', { name: 'True or false' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one.')
    const group = screen.getByRole('group', { name: 'Question types' })
    expect(group).toHaveAttribute('aria-invalid', 'true')
    await user.click(screen.getByRole('radio', { name: 'Core' }))
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(screen.getByRole('checkbox', { name: 'Multiple choice' })).toHaveFocus()
    await user.click(screen.getByRole('checkbox', { name: 'Short answer' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(group).not.toHaveAttribute('aria-invalid')
    expect(make()).not.toHaveAttribute('aria-disabled')
  })

  it('shows the busy label and ignores clicks while submitting', async () => {
    const { user, onSubmit } = setup({ submitting: true })
    const button = screen.getByRole('button', { name: 'Making quiz…' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('PluginSheet blocked states', () => {
  it('explains and blocks while a chat job runs, but Back and Cancel still work', async () => {
    const { user, onSubmit, onCancel } = setup({ jobRunning: true })
    expect(screen.getByText('Wait for the current change to finish.')).toBeInTheDocument()
    expect(make()).toHaveAttribute('aria-disabled', 'true')
    await user.click(make())
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('blocks and says so when there are no slides', () => {
    setup({ slides: { total: 0, current: 0, selected: [] } })
    expect(screen.getByText('Make some slides first.')).toBeInTheDocument()
    expect(make()).toHaveAttribute('aria-disabled', 'true')
  })

  it('does not require slides for a plugin that does not need them', async () => {
    const { user, onSubmit } = setup({
      manifest: withInputs([], { needsSlides: false }),
      slides: { total: 0, current: 0, selected: [] }
    })
    expect(screen.queryByText('Make some slides first.')).not.toBeInTheDocument()
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith({})
  })

  it('shows the Connect Claude prompt instead of running when there is no key', async () => {
    const { user, onSubmit, onConnect } = setup({ needsKey: true })
    expect(screen.queryByRole('button', { name: 'Connect Claude' })).not.toBeInTheDocument()
    await user.click(make())
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Connect Claude' }))
    expect(onConnect).toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'All 8 slides' })).toBeChecked()
  })
})

describe('PluginSheet closing', () => {
  it('goes back from the Back button with the current values', async () => {
    const { user, onBack } = setup()
    await user.click(screen.getByRole('radio', { name: 'Core' }))
    await user.click(screen.getByRole('button', { name: 'Back to chat' }))
    expect(onBack).toHaveBeenCalledWith(expect.objectContaining({ difficulty: 'core' }))
  })

  it('goes back on Esc and keeps the key to itself', async () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const { user, onBack } = setup()
    await user.keyboard('{Escape}')
    document.removeEventListener('keydown', outer)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('cancels without values', async () => {
    const { user, onCancel, onBack, onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('generated controls by input type', () => {
  const choice = (n: number, described = false): PluginInput => ({
    id: 'c',
    type: 'choice',
    label: 'Pick',
    default: 'o0',
    options: Array.from({ length: n }, (_, i) => ({
      value: `o${i}`,
      label: `Option ${i}`,
      ...(described && i === 0 ? { description: 'Described' } : {})
    }))
  })

  it('renders up to four plain options as pills', () => {
    setup({ manifest: withInputs([choice(4)]) })
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(document.querySelector('.rp')).not.toBeNull()
    expect(document.querySelector('.rc')).toBeNull()
  })

  it('renders options with descriptions as cards, however few', () => {
    setup({ manifest: withInputs([choice(2, true)]) })
    expect(document.querySelector('.rc')).not.toBeNull()
    expect(screen.getByRole('radio', { name: 'Option 0' })).toHaveAccessibleDescription('Described')
  })

  it('renders more than four plain options as a select', async () => {
    const { user, onSubmit } = setup({ manifest: withInputs([choice(5)]) })
    const select = screen.getByRole('combobox', { name: 'Pick' })
    await user.selectOptions(select, 'o3')
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith({ c: 'o3' })
  })

  it('renders a boolean as one checkbox with its default', async () => {
    const { user, onSubmit } = setup({
      manifest: withInputs([
        { id: 'answers', type: 'boolean', label: 'Add an answer slide', default: true }
      ])
    })
    const box = screen.getByRole('checkbox', { name: 'Add an answer slide' })
    expect(box).toBeChecked()
    await user.click(box)
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith({ answers: false })
  })

  it('renders text as a field and multiline text as a textarea', async () => {
    const { user, onSubmit } = setup({
      manifest: withInputs([
        { id: 'a', type: 'text', label: 'Title', placeholder: 'Short', maxLength: 20 },
        { id: 'b', type: 'text', label: 'Extra instructions', multiline: true }
      ])
    })
    const title = screen.getByRole('textbox', { name: 'Title' })
    expect(title.tagName).toBe('INPUT')
    expect(title).toHaveAttribute('placeholder', 'Short')
    expect(screen.getByRole('textbox', { name: 'Extra instructions' }).tagName).toBe('TEXTAREA')
    await user.type(title, 'Hello')
    await user.type(screen.getByRole('textbox', { name: 'Extra instructions' }), 'More')
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith({ a: 'Hello', b: 'More' })
  })

  it('keeps Make disabled for empty required text and shows its error once visited', async () => {
    const { user } = setup({
      manifest: withInputs([{ id: 't', type: 'text', label: 'Topic', required: true }])
    })
    expect(make()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByText('Please fill this in.')).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Topic' }), 'a')
    await user.clear(screen.getByRole('textbox', { name: 'Topic' }))
    expect(screen.getByText('Please fill this in.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Topic' }), 'Cells')
    expect(make()).not.toHaveAttribute('aria-disabled')
  })

  it('shows the range message when a typed number is clamped on blur', async () => {
    const { user } = setup()
    const box = screen.getByRole('spinbutton', { name: 'How many questions?' })
    await user.clear(box)
    await user.type(box, '99')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose between 3 and 30.')
    expect(box).toHaveValue(30)
    await user.click(screen.getByRole('button', { name: 'Fewer questions' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('steps numbers with the buttons within the range', async () => {
    const { user, onSubmit } = setup({ lastInputs: { count: 3 } })
    expect(screen.getByRole('button', { name: 'Fewer questions' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'More questions' }))
    await user.click(make())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ count: 4 }))
  })

  it('moves a choice with the arrow keys natively', async () => {
    const { user } = setup()
    screen.getByRole('radio', { name: 'Mixed' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Core' })).toBeChecked()
  })
})
