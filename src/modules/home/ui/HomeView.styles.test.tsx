import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { style } from './testSupport'
import { renderHome } from './renderHome'

const zone = () => screen.getByRole('button', { name: /Create a new style/ })
const files = (...names: string[]) => names.map((name) => new File(['x'], name))
const drop = (...names: string[]) =>
  fireEvent.drop(zone(), { dataTransfer: { files: files(...names), items: [], types: ['Files'] } })

describe('HomeView start a style from files', () => {
  it('drops 3 PDFs and a .jpg: queues 3, toasts about the skipped one, opens the draft', async () => {
    const createDraft = vi.fn(() => ok({ styleId: 'draft1', added: 3, rejected: [] }))
    const { shell } = renderHome({ library: { createDraft } })
    drop('a.pdf', 'b.pdf', 'c.pptx', 'photo.jpg')
    await waitFor(() =>
      expect(createDraft).toHaveBeenCalledWith({
        paths: ['/fake/a.pdf', '/fake/b.pdf', '/fake/c.pptx']
      })
    )
    expect(shell.navigate).toHaveBeenCalledWith('style-library', {
      kind: 'new-style',
      styleId: 'draft1'
    })
    expect(
      await screen.findByText('Skipped 1 file that isn’t PDF or PowerPoint.')
    ).toBeInTheDocument()
  })

  it('joins what main skipped into the same toast', async () => {
    const createDraft = vi.fn(() =>
      ok({
        styleId: 'd',
        added: 1,
        rejected: [
          { name: 'huge.pdf', reason: 'too-large' as const },
          { name: 'x.pdf', reason: 'limit' as const }
        ]
      })
    )
    renderHome({ library: { createDraft } })
    drop('a.pdf', 'old.ppt')
    const toast = await screen.findByText(/huge\.pdf is over 50 MB/)
    expect(toast).toHaveTextContent('.ppt files are too old to read. Save them as .pptx first.')
    expect(toast).toHaveTextContent('Only the first 50 files were added.')
  })

  it('does not create a draft when every dropped file is the wrong type', async () => {
    const createDraft = vi.fn()
    const { shell } = renderHome({ library: { createDraft } })
    drop('photo.jpg', 'notes.txt')
    expect(
      await screen.findByText('Skipped 2 files that aren’t PDF or PowerPoint.')
    ).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
    expect(shell.navigate).not.toHaveBeenCalled()
  })

  it('browses with the native dialog and opens the new draft', async () => {
    const pick = vi.fn(() => ok({ styleId: 'draft2', added: 2, rejected: [] }))
    const { user, shell } = renderHome({ library: { pickAndCreateDraft: pick } })
    await user.click(zone())
    await waitFor(() =>
      expect(shell.navigate).toHaveBeenCalledWith('style-library', {
        kind: 'new-style',
        styleId: 'draft2'
      })
    )
  })

  it('stays put when the dialog is cancelled', async () => {
    const pick = vi.fn(() => ok({ cancelled: true as const }))
    const { user, shell } = renderHome({ library: { pickAndCreateDraft: pick } })
    await user.click(zone())
    await waitFor(() => expect(pick).toHaveBeenCalled())
    expect(shell.navigate).not.toHaveBeenCalled()
  })

  it('says so when the draft could not be started', async () => {
    const pick = vi.fn(() => fail('io', 'The data folder is read-only.'))
    const { user, shell } = renderHome({ library: { pickAndCreateDraft: pick } })
    await user.click(zone())
    expect(await screen.findByText('The data folder is read-only.')).toBeInTheDocument()
    expect(shell.navigate).not.toHaveBeenCalled()
  })

  it('says so when the call itself throws', async () => {
    const createDraft = vi.fn(() => {
      throw new Error('ipc')
    })
    renderHome({ library: { createDraft } })
    drop('a.pdf')
    expect(await screen.findByText('I couldn’t start that style. Try again.')).toBeInTheDocument()
  })
})

describe('HomeView styles card', () => {
  it('shows a learning style and a draft with their state', async () => {
    renderHome({
      styles: [
        style({ status: 'learning', learning: { learned: 3, total: 12 }, deckCount: 3 }),
        style({ id: 'd', name: 'Draft style', isDefault: false, status: 'draft', deckCount: 0 })
      ]
    })
    expect(await screen.findByText('Learning…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft style' })).toBeInTheDocument()
  })

  it('shows the first three styles and a Show all link to the Styles list', async () => {
    const many = ['a', 'b', 'c', 'd'].map((id, i) =>
      style({ id, name: `Style ${id}`, isDefault: i === 0 })
    )
    const { user, shell } = renderHome({ styles: many })
    expect(await screen.findByRole('button', { name: 'Show all 4 styles' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Style d' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all 4 styles' }))
    expect(shell.navigate).toHaveBeenCalledWith('style-library')
  })
})
