import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ContractImpl } from '@shared/contract'
import type { SettingsApi } from '@shared/contracts/settings'
import type { StyleSummary } from '@shared/contracts/style-library'
import { ok } from '@shared/result'
import type { ModuleApi, ShellState } from '@renderer/sdk'
import { createFakeClients, fakeClient, renderWithApp } from '@test/render'
import type { StyleLibraryFullApi } from '../shared'
import { StyleLibraryView } from './StyleLibraryView'
import { fakeStyles } from './testClients'
import { makeFile, makeSummary, makeView } from './testSupport'

const api: ModuleApi = { invoke: async () => undefined as never, on: () => () => {} }

function setup(
  styles: StyleSummary[],
  shell: Partial<ShellState> = {},
  client: Partial<ContractImpl<StyleLibraryFullApi>> = {},
  subject: string | null = null
) {
  const view = makeView([makeFile()])
  const library = fakeStyles(view, { list: () => styles, ...client })
  const settings = fakeClient<SettingsApi>({
    getProfile: () =>
      ok({
        profile: {
          name: 'Alice',
          subject,
          onboarding: { step: 'done', completedAt: 'x', skippedAi: false },
          claudeConnected: true
        }
      })
  })
  const rendered = renderWithApp(<StyleLibraryView api={api} active />, {
    clients: createFakeClients({ 'style-library': library, settings }),
    shell
  })
  return { ...rendered, library }
}

describe('where the module opens', () => {
  it('opens an empty Create a style when she has no styles', async () => {
    setup([], {}, {}, 'Science')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Style name' })).toHaveValue('Science')
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).toBeChecked()
  })

  it('opens the Styles list when she has styles', async () => {
    setup([makeSummary()])
    expect(await screen.findByRole('heading', { level: 1, name: 'Styles' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your styles' })).toBeInTheDocument()
  })

  it('opens Create a style on a draft Home made, consuming the intent', async () => {
    const { shell, library } = setup([makeSummary()], {
      intent: { kind: 'new-style', styleId: 'sty_1' }
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
    expect(shell.consumeIntent).toHaveBeenCalled()
    await waitFor(() => expect(library.get).toHaveBeenCalledWith({ styleId: 'sty_1' }))
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).not.toBeChecked()
  })

  it('opens an empty draft for the first-run intent', async () => {
    setup([], { intent: { kind: 'new-style', firstRun: true } })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add your PDFs or PowerPoints/ })).toBeInTheDocument()
  })

  it('opens Edit style for an existing style', async () => {
    setup([makeSummary()], { intent: { kind: 'edit-style', styleId: 'sty_1' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit style' })).toBeInTheDocument()
  })

  it('ignores intents meant for other screens', async () => {
    setup([makeSummary()], { intent: { kind: 'something-else' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Styles' })).toBeInTheDocument()
  })

  it('shows the list for an edit intent without a style id', async () => {
    setup([makeSummary()], { intent: { kind: 'edit-style' } })
    expect(await screen.findByRole('heading', { level: 1, name: 'Styles' })).toBeInTheDocument()
  })

  it('keeps the editor an intent opened when the first-visit lookup finishes later', async () => {
    let release: (styles: StyleSummary[]) => void = () => {}
    const slow = new Promise<StyleSummary[]>((resolve) => (release = resolve))
    let calls = 0
    const { rerender, shell } = setup(
      [],
      {},
      { list: () => (calls++ === 0 ? slow : [makeSummary()]) }
    )
    shell.intent = { kind: 'edit-style', styleId: 'sty_1' }
    rerender(<StyleLibraryView api={api} active />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit style' })).toBeInTheDocument()
    release([makeSummary()])
    await waitFor(() => expect(shell.consumeIntent).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByRole('heading', { level: 1, name: 'Edit style' })).toBeInTheDocument()
  })

  it('renders nothing while the module is not active and has no intent', () => {
    const library = fakeStyles(null)
    const { container } = renderWithApp(<StyleLibraryView api={api} active={false} />, {
      clients: createFakeClients({ 'style-library': library })
    })
    expect(container).toBeEmptyDOMElement()
    expect(library.list).not.toHaveBeenCalled()
  })
})

describe('the Styles list', () => {
  const two = [
    makeSummary({ id: 's1', name: 'Science KS3', isDefault: true }),
    makeSummary({ id: 's2', name: 'Maths Y9', isDefault: false, deckCount: 3 })
  ]

  it('lists every style and opens the editor for one', async () => {
    const { user } = setup(two)
    await user.click(await screen.findByRole('button', { name: 'Maths Y9' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit style' })).toBeInTheDocument()
  })

  it('opens a draft in Create mode', async () => {
    const { user } = setup([makeSummary({ id: 's3', name: 'My style', status: 'draft' })])
    await user.click(await screen.findByRole('button', { name: 'My style' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
  })

  it('"Create a new style…" opens an empty draft', async () => {
    const { user } = setup(two)
    await user.click(await screen.findByRole('button', { name: 'Create a new style…' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).not.toBeChecked()
  })

  it('sets a style as the default', async () => {
    const { user, library } = setup(two)
    await user.click(await screen.findByRole('button', { name: /Set .*default/i }))
    expect(library.update).toHaveBeenCalledWith({ styleId: 's2', isDefault: true })
    expect(await screen.findByText('“Maths Y9” is now your default style')).toBeInTheDocument()
  })

  it('asks before deleting, and does nothing when she cancels', async () => {
    const { user, library } = setup(two)
    await user.click(await screen.findByRole('button', { name: 'Delete Maths Y9' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Delete “Maths Y9”?')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(library.deleteStyle).not.toHaveBeenCalled()
  })

  it('deletes after she confirms', async () => {
    const { user, library } = setup(two)
    await user.click(await screen.findByRole('button', { name: 'Delete Maths Y9' }))
    await user.click(await screen.findByRole('button', { name: 'Delete style' }))
    expect(library.deleteStyle).toHaveBeenCalledWith({ styleId: 's2' })
    expect(await screen.findByText('Deleted “Maths Y9”')).toBeInTheDocument()
  })

  it('goes Home from the back button', async () => {
    const { user, shell } = setup(two)
    await user.click(await screen.findByRole('button', { name: 'Home' }))
    expect(shell.navigate).toHaveBeenCalledWith('home')
  })

  it('creates a draft from decks dropped on the list and opens it', async () => {
    const { library } = setup(
      two,
      {},
      {
        createDraft: () => ok({ styleId: 's9', added: 1, rejected: [] })
      }
    )
    const zone = await screen.findByRole('button', { name: /Create a new style\s*Drop decks/ })
    const file = new File(['x'], 'A.pdf')
    fireEvent.drop(zone, { dataTransfer: { files: [file], items: [], types: ['Files'] } })
    await waitFor(() =>
      expect(library.createDraft).toHaveBeenCalledWith({ paths: ['/fake/A.pdf'] })
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
  })
})
