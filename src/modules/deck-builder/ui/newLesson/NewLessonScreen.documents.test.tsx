import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import type { DeckBuilderApi, DocumentReadResult } from '@shared/contracts/deck-builder'
import type { FakeClients } from '@test/render'
import { NEEDS_OBJECTIVES } from './buildRequest'
import { TOO_MANY_DOCUMENTS, UNREADABLE, WRONG_FILE_TYPE } from './hooks/useLoDocuments'
import { aiStatus, composer, loDocument, makeButton, renderScreen } from './testing'

const read = (documentId: string, result: DocumentReadResult) =>
  ({ documentId, result: ok(result) }) as const

const dropOn = (target: HTMLElement, ...names: string[]): void => {
  const files = names.map((name) => new File(['x'], name))
  fireEvent.drop(target, { dataTransfer: { files, items: [], types: ['Files'] } })
}

const dropzone = (): HTMLElement =>
  screen.getByRole('button', { name: /Drop your learning objectives/ })

describe('NewLessonScreen: learning-objective documents', () => {
  it('attaches a picked document and shows it being read, then what was found', async () => {
    const { user, clients } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await screen.findByText('Knows your Science KS3 style')
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    const card = await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    expect(card).toHaveTextContent('Reading…')
    clients.emit('deck-builder', 'documentRead', read('doc_1', { objectives: ['a', 'b', 'c'] }))
    await waitFor(() => expect(card).toHaveTextContent('3 objectives found'))
  })

  it('opens the same picker from the Dropzone', async () => {
    const { user, deckBuilder } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ cancelled: true }) }
    })
    await user.click(dropzone())
    expect(deckBuilder.pickLoDocument).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('group', { name: /\.docx/ })).not.toBeInTheDocument()
  })

  it('updates the year and length chips from what Claude found, unless she changed them', async () => {
    const { user, clients } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    clients.emit(
      'deck-builder',
      'documentRead',
      read('doc_1', { objectives: ['a'], yearGroup: 'Y9', durationMin: 60 })
    )
    expect(await screen.findByRole('button', { name: /^Year group: Year 9/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lesson length: 60 min/ })).toBeInTheDocument()
    expect(screen.getByText('1 objective found')).toBeInTheDocument()
  })

  it('keeps a document’s answer that arrives before the picker returns', async () => {
    let clients: FakeClients | undefined
    const pickLoDocument: DeckBuilderApi['pickLoDocument'] = () => {
      clients?.emit('deck-builder', 'documentRead', read('doc_1', { objectives: ['a', 'b'] }))
      return ok({ document: loDocument() })
    }
    const view = renderScreen({ deckBuilder: { pickLoDocument } })
    clients = view.clients
    await view.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(await screen.findByText('2 objectives found')).toBeInTheDocument()
  })

  it('does not say “Reading…” when there is no key to read it with', async () => {
    const { user } = renderScreen({
      settings: { getAiStatus: () => aiStatus({ hasKey: false }) },
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await screen.findByText('Knows your Science KS3 style')
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    const card = await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    expect(card).toHaveTextContent('Word document')
    expect(card).not.toHaveTextContent('Reading…')
  })

  it('shows a document that could not be read, and will not make slides from it alone', async () => {
    const { user, clients, deckBuilder } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    clients.emit('deck-builder', 'documentRead', {
      documentId: 'doc_1',
      result: fail('invalid-input', 'That document can’t be read.')
    })
    expect(await screen.findByText(UNREADABLE)).toBeInTheDocument()
    await user.click(makeButton())
    expect(screen.getByText(NEEDS_OBJECTIVES)).toBeInTheDocument()
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
  })

  it('makes slides from a document with no typed text', async () => {
    const { user, deckBuilder, onOpenLesson } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    await user.click(makeButton())
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalled())
    expect(deckBuilder.createLesson).toHaveBeenCalledWith(
      expect.objectContaining({ objectivesText: '', documentIds: ['doc_1'] })
    )
  })

  it('removes a document', async () => {
    const { user } = renderScreen({
      deckBuilder: { pickLoDocument: () => ok({ document: loDocument() }) }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await screen.findByRole('group', { name: 'Photosynthesis LOs.docx' })
    await user.click(screen.getByRole('button', { name: 'Remove Photosynthesis LOs.docx' }))
    expect(screen.queryByRole('group', { name: 'Photosynthesis LOs.docx' })).not.toBeInTheDocument()
    expect(makeButton()).toBeDisabled()
  })

  it('says why a picked file was refused', async () => {
    const { user } = renderScreen({
      deckBuilder: { pickLoDocument: () => fail('invalid-input', 'That file is empty.') }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(await screen.findByText('That file is empty.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /\.docx/ })).not.toBeInTheDocument()
  })

  it('copes with the picker failing altogether', async () => {
    const { user } = renderScreen({
      deckBuilder: {
        pickLoDocument: () => {
          throw new Error('dialog crashed')
        }
      }
    })
    await user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(await screen.findByText(/I couldn’t attach that file/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/I couldn’t attach that file/)).not.toBeInTheDocument()
  })
})

describe('NewLessonScreen: dropping documents', () => {
  it('imports a dropped Word document by its path', async () => {
    const importLoDocument = vi.fn(() => ok({ document: loDocument({ name: 'LOs.docx' }) }))
    renderScreen({ deckBuilder: { importLoDocument } })
    dropOn(dropzone(), 'LOs.docx')
    expect(await screen.findByRole('group', { name: 'LOs.docx' })).toBeInTheDocument()
    expect(importLoDocument).toHaveBeenCalledWith({ path: '/fake/LOs.docx' })
  })

  it('accepts a drop anywhere on the panel', async () => {
    const importLoDocument = vi.fn(() => ok({ document: loDocument() }))
    renderScreen({ deckBuilder: { importLoDocument } })
    dropOn(screen.getByRole('complementary', { name: 'Your planning buddy' }), 'plan.pdf')
    await waitFor(() => expect(importLoDocument).toHaveBeenCalledWith({ path: '/fake/plan.pdf' }))
  })

  it('refuses other file types in plain words', async () => {
    const importLoDocument = vi.fn()
    renderScreen({ deckBuilder: { importLoDocument } })
    dropOn(dropzone(), 'holiday.jpg')
    expect(await screen.findByText(WRONG_FILE_TYPE)).toBeInTheDocument()
    expect(importLoDocument).not.toHaveBeenCalled()
  })

  it('shows the reason when an import fails', async () => {
    renderScreen({
      deckBuilder: {
        importLoDocument: () => fail('invalid-input', 'That PDF is password protected.')
      }
    })
    dropOn(dropzone(), 'locked.pdf')
    expect(await screen.findByText('That PDF is password protected.')).toBeInTheDocument()
  })

  it('stops at three documents', async () => {
    let next = 0
    const { user } = renderScreen({
      deckBuilder: {
        importLoDocument: () =>
          ok({ document: loDocument({ id: `d${++next}`, name: `LO ${next}.pdf` }) })
      }
    })
    dropOn(dropzone(), 'a.pdf', 'b.pdf', 'c.pdf')
    await screen.findByRole('group', { name: 'LO 3.pdf' })
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
    expect(dropzone()).toBeDisabled()
    dropOn(screen.getByRole('complementary', { name: 'Your planning buddy' }), 'd.pdf')
    expect(await screen.findByText(TOO_MANY_DOCUMENTS)).toBeInTheDocument()
    expect(screen.getAllByRole('group', { name: /^LO \d\.pdf$/ })).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: 'Remove LO 1.pdf' }))
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeEnabled()
    expect(composer()).toBeInTheDocument()
  })
})
