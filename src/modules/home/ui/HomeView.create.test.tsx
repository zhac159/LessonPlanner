import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import type { LoDocument } from '@shared/contracts/deck-builder'
import { NOT_CONNECTED, style } from './testSupport'
import { renderHome } from './renderHome'

const STYLES = [
  style(),
  style({
    id: 's2',
    name: 'Form time',
    isDefault: false,
    primaryHex: '#7A3FA0',
    tintHex: '#EAD9FF'
  })
]
const DOC: LoDocument = { id: 'doc1', name: 'unit3-LOs.docx', kind: 'docx', sizeBytes: 4096 }

const createLesson = (extra: Record<string, unknown> = {}) =>
  vi.fn(() => ok({ lessonId: 'new1', jobId: 'job1', messageId: 'm1', ...extra }))
const objectives = () => screen.getByRole('textbox', { name: 'Learning objectives' })
const createButton = () => screen.getByRole('button', { name: 'Create lesson' })

describe('HomeView create lesson', () => {
  it('is disabled with nothing to go on and enabled after typing', async () => {
    const { user } = renderHome({ styles: STYLES })
    expect(createButton()).toBeDisabled()
    await user.type(objectives(), '   ')
    expect(createButton()).toBeDisabled()
    await user.type(objectives(), 'LO1: Describe photosynthesis')
    expect(createButton()).toBeEnabled()
  })

  it('creates the lesson with generation started and opens the editor on it', async () => {
    const create = createLesson()
    const { user, shell } = renderHome({ styles: STYLES, deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1: Describe photosynthesis')
    await user.click(createButton())
    expect(create).toHaveBeenCalledWith({
      objectivesText: 'LO1: Describe photosynthesis',
      documentIds: [],
      styleId: 's1',
      title: null,
      meta: { durationMin: 50 },
      startGeneration: true
    })
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'new1',
      jobId: 'job1'
    })
    expect(objectives()).toHaveValue('')
  })

  it('sends no title when none was typed', async () => {
    const create = createLesson()
    const { user } = renderHome({ deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: null, styleId: null }))
  })

  it('creates with Ctrl+Enter', async () => {
    const create = createLesson()
    const { user } = renderHome({ deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1{Control>}{Enter}{/Control}')
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
  })

  it('shows the Connect Claude prompt without calling main when there is no key', async () => {
    const create = createLesson()
    const { user, shell, settings } = renderHome({
      status: NOT_CONNECTED,
      deckBuilder: { createLesson: create }
    })
    await waitFor(() => expect(settings.getAiStatus).toHaveBeenCalled())
    await user.type(objectives(), 'LO1')
    await waitFor(() => expect(screen.getAllByText(/Claude isn’t connected yet/)).toHaveLength(1))
    await user.click(createButton())
    expect(create).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Claude isn’t connected yet/)).toHaveLength(2)
    const buttons = screen.getAllByRole('button', { name: 'Connect Claude' })
    await user.click(buttons[buttons.length - 1])
    expect(shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
    expect(objectives()).toHaveValue('LO1')
  })

  it('shows the prompt when main reports a missing or invalid key', async () => {
    const create = vi.fn(() => fail('no-key', 'No key'))
    const { user, shell } = renderHome({ deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    expect(await screen.findByText(/Claude isn’t connected yet/)).toBeInTheDocument()
    expect(shell.navigate).not.toHaveBeenCalled()
    expect(objectives()).toHaveValue('LO1')
  })

  it('keeps the text and shows the error inside the card when creating fails', async () => {
    const create = vi.fn(() => fail('network', 'I can’t reach Claude right now.'))
    const { user, shell } = renderHome({ deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    expect(await screen.findByText('I can’t reach Claude right now.')).toBeInTheDocument()
    expect(objectives()).toHaveValue('LO1')
    expect(shell.navigate).not.toHaveBeenCalled()
    expect(createButton()).toBeEnabled()
  })

  it('keeps the text and says so when the call itself throws', async () => {
    const create = vi.fn(() => {
      throw new Error('ipc')
    })
    const { user } = renderHome({ deckBuilder: { createLesson: create } })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    expect(await screen.findByText(/I couldn’t start that lesson/)).toBeInTheDocument()
    expect(objectives()).toHaveValue('LO1')
  })

  it('shows "Creating…" and locks the button while the lesson is made', async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {}
    const pending = new Promise<ReturnType<typeof ok>>((resolve) => (finish = resolve))
    const create = vi.fn(() => pending)
    const { user } = renderHome({ deckBuilder: { createLesson: create as never } })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    const busy = await screen.findByRole('button', { name: /Creating…/ })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await user.click(busy)
    expect(create).toHaveBeenCalledTimes(1)
    expect(objectives()).toBeEnabled()
    finish(ok({ lessonId: 'x', jobId: null, messageId: null }) as never)
  })
})

describe('HomeView lesson document', () => {
  it('attaches a document, enables Create with empty text and sends its id', async () => {
    const create = createLesson()
    const pick = vi.fn(() => ok({ document: DOC }))
    const { user } = renderHome({ deckBuilder: { createLesson: create, pickLoDocument: pick } })
    await user.click(screen.getByRole('button', { name: 'Upload LO document' }))
    expect(await screen.findByText('unit3-LOs.docx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace document' })).toBeInTheDocument()
    expect(createButton()).toBeEnabled()
    await user.click(createButton())
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ documentIds: ['doc1'], objectivesText: '' })
    )
  })

  it('removes the attachment with ×', async () => {
    const pick = vi.fn(() => ok({ document: DOC }))
    const { user } = renderHome({ deckBuilder: { pickLoDocument: pick } })
    await user.click(screen.getByRole('button', { name: 'Upload LO document' }))
    await user.click(await screen.findByRole('button', { name: 'Remove unit3-LOs.docx' }))
    expect(screen.queryByText('unit3-LOs.docx')).not.toBeInTheDocument()
    expect(createButton()).toBeDisabled()
  })

  it('does nothing when the dialog is cancelled', async () => {
    const pick = vi.fn(() => ok({ cancelled: true as const }))
    const { user } = renderHome({ deckBuilder: { pickLoDocument: pick } })
    await user.click(screen.getByRole('button', { name: 'Upload LO document' }))
    await waitFor(() => expect(pick).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Upload LO document' })).toBeInTheDocument()
  })

  it('tells her when the document could not be attached', async () => {
    const pick = vi.fn(() => fail('io', 'That file is locked.'))
    const { user } = renderHome({ deckBuilder: { pickLoDocument: pick } })
    await user.click(screen.getByRole('button', { name: 'Upload LO document' }))
    expect(await screen.findByText('That file is locked.')).toBeInTheDocument()
  })

  it('imports a document dropped on the card by its real path', async () => {
    const importDoc = vi.fn(() => ok({ document: DOC }))
    renderHome({ deckBuilder: { importLoDocument: importDoc } })
    const card = screen.getByRole('region', { name: 'Make a new lesson' })
    const file = new File(['x'], 'unit3-LOs.docx')
    fireEvent.drop(card, { dataTransfer: { types: ['Files'], files: [file] } })
    await waitFor(() => expect(importDoc).toHaveBeenCalledWith({ path: '/fake/unit3-LOs.docx' }))
    expect(await screen.findByText('unit3-LOs.docx')).toBeInTheDocument()
  })

  it('refuses anything but one .docx, .pdf or .pptx dropped on the card', async () => {
    const importDoc = vi.fn(() => ok({ document: DOC }))
    renderHome({ deckBuilder: { importLoDocument: importDoc } })
    const card = screen.getByRole('region', { name: 'Make a new lesson' })
    fireEvent.drop(card, {
      dataTransfer: { types: ['Files'], files: [new File(['x'], 'photo.jpg')] }
    })
    expect(
      await screen.findByText('Only .docx, .pdf and .pptx files can be attached.')
    ).toBeInTheDocument()
    expect(importDoc).not.toHaveBeenCalled()
  })
})

describe('HomeView style and length chips', () => {
  it('starts on the default style and 50 min', async () => {
    renderHome({ styles: STYLES })
    expect(await screen.findByRole('button', { name: /Style: Science KS3/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lesson length: 50 min/ })).toBeInTheDocument()
  })

  it('creates with the chosen style and length, and remembers the length', async () => {
    const create = createLesson()
    const { user, settings } = renderHome({ styles: STYLES, deckBuilder: { createLesson: create } })
    await user.click(await screen.findByRole('button', { name: /Style: Science KS3/ }))
    await user.click(screen.getByRole('option', { name: 'Form time' }))
    await user.click(screen.getByRole('button', { name: /Lesson length/ }))
    await user.click(screen.getByRole('option', { name: '45 min' }))
    expect(settings.setPreferences).toHaveBeenCalledWith({ lastLengthMin: 45 })
    await user.type(objectives(), 'LO1')
    await user.click(createButton())
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ styleId: 's2', meta: { durationMin: 45 } })
    )
  })

  it('starts with the last length used', async () => {
    renderHome({ prefs: { lastLengthMin: 60 } })
    expect(await screen.findByRole('button', { name: /Lesson length: 60 min/ })).toBeInTheDocument()
  })

  it('"Create a new style…" opens an empty draft', async () => {
    const { user, shell } = renderHome({ styles: STYLES })
    await user.click(await screen.findByRole('button', { name: /Style: Science KS3/ }))
    await user.click(screen.getByRole('option', { name: 'Create a new style…' }))
    expect(shell.navigate).toHaveBeenCalledWith('style-library', { kind: 'new-style' })
  })
})
