import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReviewBatch, ReviewEdit, ReviewView } from '@shared/contracts/assets'
import { fail, ok } from '@shared/result'
import { createFakeClients, renderWithApp } from '@test/render'
import { BATCH, fakeAssets, makeCandidate, makeReview, makeSummary } from '../testSupport'
import { ReviewScreen } from './ReviewScreen'

function setup(view: ReviewView = makeReview(), overrides: Parameters<typeof fakeAssets>[0] = {}) {
  const onBack = vi.fn()
  const assets = fakeAssets({ 'review:get': () => view, 'review:edit': echo(view), ...overrides })
  const clients = createFakeClients({ assets })
  const rendered = renderWithApp(<ReviewScreen onBack={onBack} />, { clients })
  return { ...rendered, assets, clients, onBack }
}

/** Answers an edit like main: the candidate with the change applied (its reason stays). */
const echo =
  (view: ReviewView = makeReview()) =>
  ({ candidateId, keep, name, kind }: ReviewEdit) => {
    const old = view.candidates.find((c) => c.id === candidateId)!
    return ok({
      candidate: {
        ...old,
        keep: keep ?? old.keep,
        name: name ?? old.name,
        kind: kind ?? old.kind
      }
    })
  }

const keepBox = (name: string) =>
  screen.findByRole('checkbox', { name: new RegExp(`Keep ${name}`) })

describe('Check what I found (A2)', () => {
  it('shows the counts, the files, the candidates and why one was left out', async () => {
    setup()
    expect(await screen.findByText('Found 3 · keeping 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep 2 assets' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
    expect(screen.getByText('While learning Science KS3')).toBeInTheDocument()
    expect(screen.getByText('Y8 Photosynthesis.pptx')).toBeInTheDocument()
    expect(screen.getByText('4 found')).toBeInTheDocument()
    expect(screen.getByText('May show pupils · left out')).toBeInTheDocument()
    expect(screen.getAllByText('In 6 decks').length).toBe(3)
    expect(await keepBox('class_photo')).not.toBeChecked()
    expect(await keepBox('school_logo')).toBeChecked()
    expect(screen.getByText(/I leave out photos that might show pupils/)).toBeInTheDocument()
  })

  it('updates both counts at once when she unticks, and when she ticks a left-out one', async () => {
    const edit = vi.fn(echo())
    const { user } = setup(makeReview(), { 'review:edit': edit })
    await user.click(await keepBox('owl_mascot'))
    expect(edit).toHaveBeenCalledWith({ candidateId: 'c-owl_mascot', keep: false })
    expect(screen.getByText('Found 3 · keeping 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep 1 asset' })).toBeInTheDocument()
    await user.click(await keepBox('class_photo'))
    expect(screen.getByText('Found 3 · keeping 2')).toBeInTheDocument()
    expect(screen.getByText('May show pupils · left out')).toBeInTheDocument()
  })

  it('goes back to the old tick when main refuses the change', async () => {
    const { user } = setup(makeReview(), {
      'review:edit': () => fail('io', 'Couldn’t save that.')
    })
    await user.click(await keepBox('owl_mascot'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save that.')
    expect(screen.getByText('Found 3 · keeping 2')).toBeInTheDocument()
  })

  it('shows a taken name under the field and keeps Keep off until it is fixed', async () => {
    const edit = vi.fn(({ candidateId, name }: { candidateId: string; name?: string }) =>
      name === 'taken_name'
        ? fail('invalid-input', 'You already have an asset called taken_name.')
        : ok({ candidate: makeCandidate(name ?? 'x', { id: candidateId }) })
    )
    const accept = vi.fn(() => ok({ added: [] }))
    const { user } = setup(makeReview(), { 'review:edit': edit, 'review:accept': accept })
    const field = await screen.findByRole('textbox', { name: 'Name of school_logo' })
    await user.clear(field)
    await user.type(field, 'taken_name{Enter}')
    expect(
      await screen.findByText('You already have an asset called taken_name.')
    ).toBeInTheDocument()
    const keep = screen.getByRole('button', { name: 'Keep 2 assets' })
    expect(keep).toHaveAttribute('aria-disabled', 'true')
    expect(keep).toHaveAccessibleDescription(/Fix the name of school_logo first/)
    await user.click(keep)
    expect(accept).not.toHaveBeenCalled()
    await user.clear(field)
    await user.type(field, 'crest_logo{Enter}')
    await waitFor(() =>
      expect(
        screen.queryByText('You already have an asset called taken_name.')
      ).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Keep 2 assets' })).not.toHaveAttribute(
      'aria-disabled'
    )
  })

  it('changes the kind from the pill', async () => {
    const edit = vi.fn(({ candidateId }: { candidateId: string }) =>
      ok({ candidate: makeCandidate(candidateId.slice(2), { kind: 'diagram' }) })
    )
    const { user } = setup(makeReview(), { 'review:edit': edit })
    await user.selectOptions(await screen.findByLabelText('Kind of owl_mascot'), 'diagram')
    expect(edit).toHaveBeenCalledWith({ candidateId: 'c-owl_mascot', kind: 'diagram' })
  })

  it('keeps the ticked ones, says so with Undo and goes back to the library', async () => {
    const added = [makeSummary('school_logo'), makeSummary('owl_mascot')]
    const accept = vi.fn(() => ok({ added }))
    const remove = vi.fn(() => ok())
    const { user, onBack } = setup(makeReview(), { 'review:accept': accept, remove })
    await user.click(await screen.findByRole('button', { name: 'Keep 2 assets' }))
    expect(accept).toHaveBeenCalledWith({})
    expect(await screen.findByText('2 assets added to Your assets')).toBeInTheDocument()
    expect(onBack).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(2))
    expect(remove).toHaveBeenCalledWith({ assetId: 'id-owl_mascot' })
  })

  it('stays open for the files still being read', async () => {
    const reading: ReviewBatch = {
      ...BATCH,
      working: true,
      files: [
        ...BATCH.files,
        {
          id: 'f3',
          name: 'Y7 icon sheet.pdf',
          kind: 'pdf',
          found: 0,
          state: 'working',
          progress: { done: 4, total: 6 }
        }
      ]
    }
    const accept = vi.fn(() => ok({ added: [makeSummary('school_logo')] }))
    const { user, onBack } = setup(makeReview({ batches: [reading], stillReading: 1 }), {
      'review:accept': accept
    })
    expect(await screen.findByText('Still reading 1 file')).toBeInTheDocument()
    expect(screen.getByText('Cutting out pictures · page 4 of 6')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    await user.click(screen.getByRole('button', { name: 'Keep 2 assets' }))
    expect(await screen.findByText('1 asset added to Your assets')).toBeInTheDocument()
    expect(onBack).not.toHaveBeenCalled()
  })

  it('follows review:changed while files are read', async () => {
    const { clients } = setup(makeReview({ candidates: [makeCandidate('school_logo')] }))
    expect(await screen.findByText('Found 1 · keeping 1')).toBeInTheDocument()
    act(() =>
      clients.emit(
        'assets',
        'review:changed',
        makeReview({ candidates: [makeCandidate('school_logo'), makeCandidate('leaf_icon')] })
      )
    )
    expect(await screen.findByText('Found 2 · keeping 2')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name of leaf_icon' })).toBeInTheDocument()
  })

  it('filters with All, Keeping and Left out, and says when nothing is there', async () => {
    const { user } = setup()
    await screen.findByText('Found 3 · keeping 2')
    await user.click(screen.getByRole('button', { name: 'Left out' }))
    expect(screen.getByRole('textbox', { name: 'Name of class_photo' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Name of school_logo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keeping' }))
    expect(screen.queryByRole('textbox', { name: 'Name of class_photo' })).not.toBeInTheDocument()
    await user.click(await keepBox('school_logo'))
    await user.click(await keepBox('owl_mascot'))
    expect(await screen.findByText('Nothing here.')).toBeInTheDocument()
  })

  it('disables Keep at zero with "Nothing to keep"', async () => {
    setup(makeReview({ candidates: [makeCandidate('class_photo', { keep: false })] }))
    expect(await screen.findByRole('button', { name: 'Nothing to keep' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('collapses long file lists into "+3 3 more decks"', async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      id: `f${i}`,
      name: `Deck ${i}.pptx`,
      kind: 'pptx' as const,
      found: 1,
      state: 'done' as const,
      progress: null
    }))
    const { user } = setup(makeReview({ batches: [{ ...BATCH, files }] }))
    await user.click(await screen.findByRole('button', { name: /3 more decks/ }))
    expect(screen.getByText('Deck 5.pptx')).toBeInTheDocument()
  })

  it('shows a file that could not be read and carries on with the others', async () => {
    const failed: ReviewBatch = {
      ...BATCH,
      files: [
        ...BATCH.files,
        {
          id: 'f9',
          name: 'Scans.pdf',
          kind: 'pdf',
          found: 0,
          state: 'failed',
          progress: null,
          error: 'This PDF is only scanned pages, so there’s nothing to cut out.'
        }
      ]
    }
    setup(makeReview({ batches: [failed] }))
    expect(await screen.findByText("Couldn't read")).toBeInTheDocument()
    expect(screen.getByText(/only scanned pages/)).toBeInTheDocument()
    expect(screen.getByText('Y8 Photosynthesis.pptx')).toBeInTheDocument()
  })

  describe('Try again on a file that could not be read', () => {
    const failedBatch: ReviewBatch = {
      ...BATCH,
      files: [
        ...BATCH.files,
        {
          id: 'f9',
          name: 'Scans.pdf',
          kind: 'pdf',
          found: 0,
          state: 'failed',
          progress: null,
          error: 'This file could not be read.'
        }
      ]
    }

    it('asks main to read that file again', async () => {
      const retry = vi.fn(() => ok())
      const { user } = setup(makeReview({ batches: [failedBatch] }), { 'review:retry': retry })
      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      expect(retry).toHaveBeenCalledWith({ batchId: failedBatch.id, fileId: 'f9' })
    })

    it('says why when it cannot (the app no longer has the file)', async () => {
      const retry = vi.fn(() => fail('not-found', 'I no longer have that file. Add it again.'))
      const { user } = setup(makeReview({ batches: [failedBatch] }), { 'review:retry': retry })
      await user.click(await screen.findByRole('button', { name: 'Try again' }))
      expect(
        await screen.findByText('I no longer have that file. Add it again.')
      ).toBeInTheDocument()
    })
  })

  it('says when nothing was found and goes back to Assets', async () => {
    const { user, onBack } = setup(makeReview({ candidates: [] }))
    expect(
      await screen.findByRole('heading', {
        name: 'I couldn’t find any pictures to reuse in these files.'
      })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Assets' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('goes back with the back button without throwing anything away', async () => {
    const dismiss = vi.fn(() => ok())
    const { user, onBack } = setup(makeReview(), { 'review:dismiss': dismiss })
    await user.click(await screen.findByRole('button', { name: 'Assets' }))
    expect(onBack).toHaveBeenCalled()
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('throws the batches away only after she confirms', async () => {
    const dismiss = vi.fn(() => ok())
    const { user, onBack } = setup(makeReview(), { 'review:dismiss': dismiss })
    await user.click(await screen.findByRole('button', { name: 'Throw these away' }))
    const dialog = await screen.findByRole('dialog', { name: 'Throw these away?' })
    expect(dialog).toHaveTextContent('Nothing from these files will be saved.')
    await user.click(within(dialog).getByRole('button', { name: 'Keep looking' }))
    expect(dismiss).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Throw these away' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Throw away' })
    )
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith({ batchId: 'b1' }))
    await waitFor(() => expect(onBack).toHaveBeenCalled())
  })

  it('adds more files from the small dropzone', async () => {
    const pick = vi.fn(() => ok({ batchId: 'b2', accepted: 1, rejected: [] }))
    const { user } = setup(makeReview(), { 'add:pick': pick })
    await user.click(
      await screen.findByRole('button', { name: /Add images, a PDF or a PowerPoint/ })
    )
    expect(pick).toHaveBeenCalled()
  })

  it('offers a way back when the review cannot be opened', async () => {
    const { user, onBack } = setup(makeReview(), {
      'review:get': () => Promise.reject(new Error('io')) as never
    })
    expect(await screen.findByText('Couldn’t open the review')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to Assets' }))
    expect(onBack).toHaveBeenCalled()
  })
})
