import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { style } from '../fixtures'
import type { NewLessonForm } from '../hooks/useNewLesson'
import { NewLessonCard } from './NewLessonCard'

const SCIENCE = style()
const FORM = style({
  id: 's2',
  name: 'Form time',
  isDefault: false,
  primaryHex: '#7A3FA0',
  tintHex: '#EAD9FF'
})

function fakeForm(over: Partial<NewLessonForm> = {}): NewLessonForm {
  return {
    text: '',
    document: null,
    styleId: 's1',
    lengthMin: 50,
    creating: false,
    needsClaude: false,
    error: null,
    canCreate: false,
    setText: vi.fn(),
    chooseStyle: vi.fn(),
    chooseLength: vi.fn(),
    pickDocument: vi.fn(async () => {}),
    dropDocument: vi.fn(async () => {}),
    removeDocument: vi.fn(),
    create: vi.fn(async () => {}),
    ...over
  }
}

function setup(form: NewLessonForm, styles = [SCIENCE, FORM]) {
  const onCreateStyle = vi.fn()
  const onConnectClaude = vi.fn()
  render(
    <NewLessonCard
      form={form}
      styles={styles}
      onCreateStyle={onCreateStyle}
      onConnectClaude={onConnectClaude}
    />
  )
  return { onCreateStyle, onConnectClaude }
}

describe('NewLessonCard', () => {
  it('shows the heading and the intro', () => {
    setup(fakeForm())
    expect(screen.getByRole('heading', { name: 'Make a new lesson' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Paste your learning objectives, or drop the document they’re in. I’ll build the slides in your style.'
      )
    ).toBeInTheDocument()
  })

  it('has a labelled objectives box with the example placeholder', () => {
    setup(fakeForm())
    const objectives = screen.getByRole('textbox', { name: 'Learning objectives' })
    expect(objectives).toHaveAttribute(
      'placeholder',
      expect.stringContaining('e.g. Year 8 Science — Photosynthesis')
    )
    expect(objectives).toHaveAttribute(
      'placeholder',
      expect.stringContaining('LO2: Write the word equation…')
    )
  })

  it('reports typing', async () => {
    const form = fakeForm()
    setup(form)
    await userEvent.type(screen.getByRole('textbox', { name: 'Learning objectives' }), 'L')
    expect(form.setText).toHaveBeenCalledWith('L')
  })

  it('disables Create lesson until there is something to create from', () => {
    setup(fakeForm({ canCreate: false }))
    expect(screen.getByRole('button', { name: 'Create lesson' })).toBeDisabled()
  })

  it('creates with the button and with Ctrl+Enter', async () => {
    const form = fakeForm({ canCreate: true, text: 'LO1' })
    setup(form)
    await userEvent.click(screen.getByRole('button', { name: 'Create lesson' }))
    screen.getByRole('textbox', { name: 'Learning objectives' }).focus()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(form.create).toHaveBeenCalledTimes(2)
  })

  it('lets Enter add a line instead of creating', async () => {
    const form = fakeForm({ canCreate: true, text: 'LO1' })
    setup(form)
    screen.getByRole('textbox', { name: 'Learning objectives' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(form.create).not.toHaveBeenCalled()
  })

  it('shows "Creating…" and cannot be pressed again while creating', () => {
    setup(fakeForm({ canCreate: true, creating: true }))
    const button = screen.getByRole('button', { name: /Creating…/ })
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('offers Upload LO document, then Replace document with an attachment card', async () => {
    const form = fakeForm()
    const { rerender } = render(
      <NewLessonCard
        form={form}
        styles={[SCIENCE]}
        onCreateStyle={() => {}}
        onConnectClaude={() => {}}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Upload LO document' }))
    expect(form.pickDocument).toHaveBeenCalledTimes(1)
    const attached = fakeForm({
      document: { id: 'd1', name: 'unit3-LOs.docx', kind: 'docx', sizeBytes: 2048 }
    })
    rerender(
      <NewLessonCard
        form={attached}
        styles={[SCIENCE]}
        onCreateStyle={() => {}}
        onConnectClaude={() => {}}
      />
    )
    expect(screen.getByText('unit3-LOs.docx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace document' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove unit3-LOs.docx' }))
    expect(attached.removeDocument).toHaveBeenCalledTimes(1)
  })

  it('names the style and length chips', () => {
    setup(fakeForm())
    expect(screen.getByRole('button', { name: /Style: Science KS3/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lesson length: 50 min/ })).toBeInTheDocument()
  })

  it('lists styles and "Create a new style…" in the style menu', async () => {
    const form = fakeForm()
    const { onCreateStyle } = setup(form)
    await userEvent.click(screen.getByRole('button', { name: /Style: Science KS3/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Science KS3',
      'Form time',
      'Create a new style…'
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Form time' }))
    expect(form.chooseStyle).toHaveBeenCalledWith('s2')
    await userEvent.click(screen.getByRole('button', { name: /Style: Science KS3/ }))
    await userEvent.click(screen.getByRole('option', { name: 'Create a new style…' }))
    expect(onCreateStyle).toHaveBeenCalledTimes(1)
  })

  it('reads "Plain style" when there are no styles', () => {
    setup(fakeForm({ styleId: null }), [])
    expect(screen.getByRole('button', { name: /Style: Plain style/ })).toBeInTheDocument()
  })

  it('offers the seven lengths and reports the choice', async () => {
    const form = fakeForm()
    setup(form)
    await userEvent.click(screen.getByRole('button', { name: /Lesson length/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '30 min',
      '40 min',
      '45 min',
      '50 min',
      '60 min',
      '75 min',
      '90 min'
    ])
    await userEvent.click(screen.getByRole('option', { name: '45 min' }))
    expect(form.chooseLength).toHaveBeenCalledWith(45)
  })

  it('shows the Connect Claude prompt inside the card', async () => {
    const { onConnectClaude } = setup(fakeForm({ needsClaude: true, canCreate: true }))
    expect(
      screen.getByText('Claude isn’t connected yet, so I can’t make slides.')
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Connect Claude' }))
    expect(onConnectClaude).toHaveBeenCalledTimes(1)
  })

  it('shows a failure in the card and keeps the text', () => {
    setup(fakeForm({ error: 'I couldn’t start that lesson.', text: 'LO1' }))
    expect(screen.getByRole('alert')).toHaveTextContent('I couldn’t start that lesson.')
    expect(screen.getByRole('textbox', { name: 'Learning objectives' })).toHaveValue('LO1')
  })

  it('highlights while a file is dragged over and hands dropped files on', () => {
    const form = fakeForm()
    setup(form)
    const card = screen.getByRole('region', { name: 'Make a new lesson' })
    const file = new File(['x'], 'los.docx')
    const dataTransfer = { types: ['Files'], files: [file] }
    fireEvent.dragEnter(card, { dataTransfer })
    expect(card).toHaveAttribute('data-dragging', 'true')
    fireEvent.drop(card, { dataTransfer })
    expect(card).not.toHaveAttribute('data-dragging')
    expect(form.dropDocument).toHaveBeenCalledWith([file])
  })

  it('ignores drags that carry no files', () => {
    setup(fakeForm())
    const card = screen.getByRole('region', { name: 'Make a new lesson' })
    fireEvent.dragEnter(card, { dataTransfer: { types: ['text/plain'], files: [] } })
    expect(card).not.toHaveAttribute('data-dragging')
  })
})
