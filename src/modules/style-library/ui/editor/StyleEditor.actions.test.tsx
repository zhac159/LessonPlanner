import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { designFiles, makeFile, makeSummary, makeView } from '../testSupport'
import { renderEditor } from './testHarness'

const pdf = (name: string) => new File(['x'], name, { type: 'application/pdf' })
const drop = (target: Element, files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files, items: [], types: ['Files'] } })

describe('adding files', () => {
  it('opens the native dialog from the dropzone and from Ctrl+O', async () => {
    const { user, styles } = renderEditor({ view: makeView([makeFile()]) })
    await user.click(await screen.findByRole('button', { name: /Add more PDFs or PowerPoints/ }))
    expect(styles.pickFiles).toHaveBeenCalledWith({ styleId: 'sty_1' })
    await user.keyboard('{Control>}o{/Control}')
    expect(styles.pickFiles).toHaveBeenCalledTimes(2)
  })

  it('does nothing visible when the dialog is cancelled', async () => {
    const { user } = renderEditor({ view: makeView([makeFile()]) })
    await user.click(await screen.findByRole('button', { name: /Add more PDFs/ }))
    expect(screen.queryByRole('status', { name: /Skipped/ })).not.toBeInTheDocument()
  })

  it('sends the paths of dropped files to main', async () => {
    const { styles } = renderEditor({ view: makeView([makeFile()]) })
    const zone = await screen.findByRole('button', { name: /Add more PDFs/ })
    drop(zone, [pdf('Waves.pdf'), pdf('Light.pdf')])
    await waitFor(() =>
      expect(styles.addFiles).toHaveBeenCalledWith({
        styleId: 'sty_1',
        paths: ['/fake/Waves.pdf', '/fake/Light.pdf']
      })
    )
  })

  it('accepts a drop anywhere on the page', async () => {
    const { styles } = renderEditor({ view: makeView([makeFile()]) })
    await screen.findByRole('heading', { name: 'Your files' })
    drop(screen.getByRole('heading', { name: 'What I’ve learned so far' }), [pdf('Anywhere.pdf')])
    await waitFor(() => expect(styles.addFiles).toHaveBeenCalledTimes(1))
  })

  it('skips files that are not PDF or PowerPoint and says so', async () => {
    const { styles } = renderEditor({ view: makeView([makeFile()]) })
    const zone = await screen.findByRole('button', { name: /Add more PDFs/ })
    drop(zone, [new File(['x'], 'notes.docx'), new File(['x'], 'pic.png')])
    expect(
      await screen.findByText('Skipped 2 files that aren’t PDF or PowerPoint.')
    ).toBeInTheDocument()
    expect(styles.addFiles).not.toHaveBeenCalled()
  })

  it('tells her about duplicates and the 50-file limit from main', async () => {
    const { styles } = renderEditor({
      view: makeView([makeFile()]),
      client: {
        addFiles: () =>
          ok({
            added: 0,
            rejected: [
              { name: 'Same.pdf', reason: 'duplicate' as const },
              { name: 'x.pdf', reason: 'limit' as const },
              { name: 'y.pdf', reason: 'limit' as const }
            ]
          })
      }
    })
    drop(await screen.findByRole('button', { name: /Add more PDFs/ }), [pdf('Same.pdf')])
    expect(await screen.findByText('Same.pdf is already in this style.')).toBeInTheDocument()
    expect(screen.getByText('Only 50 files per style. I skipped 2.')).toBeInTheDocument()
    expect(styles.addFiles).toHaveBeenCalled()
  })

  it('shows an error toast when main refuses', async () => {
    renderEditor({
      view: makeView([makeFile()]),
      client: { addFiles: () => fail('io', 'The disk is full') }
    })
    drop(await screen.findByRole('button', { name: /Add more PDFs/ }), [pdf('A.pdf')])
    expect(await screen.findByText('The disk is full')).toBeInTheDocument()
  })

  it('creates the draft from the first dropped files and then shows them', async () => {
    const created = makeView(
      [makeFile({ id: 'n1', name: 'First.pdf', kind: 'pdf', status: 'waiting' })],
      {
        id: 'sty_new'
      }
    )
    const { styles } = renderEditor({
      view: null,
      client: {
        createDraft: () => ok({ styleId: 'sty_new', added: 1, rejected: [] }),
        get: () => ok({ style: created })
      }
    })
    drop(screen.getByRole('button', { name: /Add your PDFs or PowerPoints/ }), [pdf('First.pdf')])
    expect(await screen.findByText('First.pdf')).toBeInTheDocument()
    expect(styles.createDraft).toHaveBeenCalledWith({ paths: ['/fake/First.pdf'] })
    expect(styles.get).toHaveBeenCalledWith({ styleId: 'sty_new' })
  })

  it('creates the draft from the dialog when there is no style yet', async () => {
    const created = makeView([makeFile({ id: 'n1', name: 'Picked.pptx' })], { id: 'sty_new' })
    const { user, styles } = renderEditor({
      view: null,
      client: {
        pickAndCreateDraft: () => ok({ styleId: 'sty_new', added: 1, rejected: [] }),
        get: () => ok({ style: created })
      }
    })
    await user.click(screen.getByRole('button', { name: /Add your PDFs or PowerPoints/ }))
    expect(await screen.findByText('Picked.pptx')).toBeInTheDocument()
    expect(styles.pickAndCreateDraft).toHaveBeenCalled()
  })

  it('shortens the list to five rows with a toggle when the cards are stacked', async () => {
    const { user } = renderEditor({ view: makeView(designFiles()), stacked: true })
    const rows = async () =>
      within(await screen.findByRole('list', { name: 'Your files' })).getAllByRole('listitem')
    expect(await rows()).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'Show all 8 files' }))
    expect(await rows()).toHaveLength(8)
    await user.click(screen.getByRole('button', { name: 'Show fewer files' }))
    expect(await rows()).toHaveLength(5)
  })
})

describe('removing files', () => {
  it('removes a file, offers Undo and restores it', async () => {
    const { user, styles } = renderEditor({
      view: makeView([makeFile({ id: 'a' }), makeFile({ id: 'b', name: 'Other.pptx' })])
    })
    await user.click(await screen.findByRole('button', { name: 'Remove Y8 Photosynthesis.pptx' }))
    expect(styles.removeFile).toHaveBeenCalledWith({ styleId: 'sty_1', fileId: 'a' })
    expect(await screen.findByText('Removed Y8 Photosynthesis.pptx')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() =>
      expect(styles.restoreFile).toHaveBeenCalledWith({ styleId: 'sty_1', fileId: 'a' })
    )
  })

  it('shows main’s error when removal fails', async () => {
    const { user } = renderEditor({
      view: makeView([makeFile()]),
      client: { removeFile: () => fail('not-found', 'File not found') }
    })
    await user.click(await screen.findByRole('button', { name: /Remove Y8/ }))
    expect(await screen.findByText('File not found')).toBeInTheDocument()
  })
})

describe('style name and default', () => {
  it('saves the name 500 ms after typing stops', async () => {
    const { user, styles } = renderEditor({ view: makeView([makeFile()]) })
    const field = await screen.findByRole('textbox', { name: 'Style name' })
    await user.clear(field)
    await user.type(field, 'Maths Y9')
    expect(styles.update).not.toHaveBeenCalled()
    await waitFor(
      () => expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_1', name: 'Maths Y9' }),
      { timeout: 3000 }
    )
    expect(styles.update).toHaveBeenCalledTimes(1)
  })

  it('stops at 40 characters', async () => {
    const { user } = renderEditor({ view: makeView([makeFile()]) })
    const field = await screen.findByRole('textbox', { name: 'Style name' })
    await user.clear(field)
    await user.type(field, 'x'.repeat(50))
    expect(field).toHaveValue('x'.repeat(40))
  })

  it('saves "Make this my default style" straight away', async () => {
    const { user, styles } = renderEditor({ view: makeView([makeFile()]) })
    await user.click(await screen.findByRole('checkbox', { name: 'Make this my default style' }))
    expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_1', isDefault: true })
  })
})

describe('corrections', () => {
  it('sends the text, shows Claude’s line, clears the box and lists the correction', async () => {
    const { user, styles } = renderEditor({
      view: makeView([makeFile()], {
        corrections: [{ text: 'Earlier one', at: '2026-10-01T09:00:00.000Z' }]
      }),
      client: {
        correct: () => ok({ message: 'Got it: title slides won’t use the yellow box.', version: 2 })
      }
    })
    const field = await screen.findByRole('textbox', { name: 'Anything I got wrong?' })
    expect(screen.getByRole('button', { name: 'Tell me' })).toBeDisabled()
    await user.type(field, 'I never use yellow on title slides{Enter}')
    expect(styles.correct).toHaveBeenCalledWith({
      styleId: 'sty_1',
      text: 'I never use yellow on title slides'
    })
    expect(
      await screen.findByText('Got it: title slides won’t use the yellow box.')
    ).toBeInTheDocument()
    expect(field).toHaveValue('')
    expect(screen.getByRole('button', { name: /Your corrections \(1\)/ })).toBeInTheDocument()
  })

  it('shows Updating… while Claude works', async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {}
    const pending = new Promise<ReturnType<typeof ok>>((resolve) => (finish = resolve))
    const { user } = renderEditor({
      view: makeView([makeFile()]),
      client: { correct: () => pending as never }
    })
    await user.type(
      await screen.findByRole('textbox', { name: 'Anything I got wrong?' }),
      'less yellow'
    )
    await user.click(screen.getByRole('button', { name: 'Tell me' }))
    expect(await screen.findByRole('button', { name: 'Updating…' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Anything I got wrong?' })).toBeDisabled()
    finish(ok({ message: 'Done.', version: 2 }) as never)
    expect(await screen.findByText('Done.')).toBeInTheDocument()
  })

  it('keeps the text and shows the AI error copy on failure', async () => {
    const { user } = renderEditor({
      view: makeView([makeFile()]),
      client: { correct: () => fail('no-credit', 'Your Claude account is out of credit.') }
    })
    const field = await screen.findByRole('textbox', { name: 'Anything I got wrong?' })
    await user.type(field, 'less yellow{Enter}')
    expect(await screen.findByText('Your Claude account is out of credit.')).toBeInTheDocument()
    expect(field).toHaveValue('less yellow')
  })
})

describe('saving', () => {
  it('saves, thanks her with a toast and goes Home', async () => {
    const onSaved = vi.fn()
    const { user, styles, shell } = renderEditor({
      view: makeView(designFiles()),
      props: { onSaved }
    })
    await user.click(await screen.findByRole('button', { name: 'Save style' }))
    expect(styles.save).toHaveBeenCalledWith({ styleId: 'sty_1' })
    expect(
      await screen.findByText('Saved “Science KS3”. I’ll keep learning from the other 2 files.')
    ).toBeInTheDocument()
    expect(shell.navigate).toHaveBeenCalledWith('home')
    expect(onSaved).toHaveBeenCalled()
  })

  it('uses the short toast when nothing is left to read', async () => {
    const { user } = renderEditor({ view: makeView([makeFile()]) })
    await user.click(await screen.findByRole('button', { name: 'Save style' }))
    expect(await screen.findByText('Saved “Science KS3”')).toBeInTheDocument()
  })

  it('asks for a name instead of saving when it is empty', async () => {
    const { user, styles, shell } = renderEditor({ view: makeView([makeFile()]) })
    const field = await screen.findByRole('textbox', { name: 'Style name' })
    await user.clear(field)
    await user.click(screen.getByRole('button', { name: 'Save style' }))
    expect(await screen.findByText('Give this style a name.')).toBeInTheDocument()
    expect(field).toHaveFocus()
    expect(styles.save).not.toHaveBeenCalled()
    expect(shell.navigate).not.toHaveBeenCalled()
  })

  it('stays on the page and explains when main refuses', async () => {
    const { user, shell } = renderEditor({
      view: makeView([makeFile()]),
      client: { save: () => fail('invalid-input', 'Learn at least one file first') }
    })
    await user.click(await screen.findByRole('button', { name: 'Save style' }))
    expect(await screen.findByText('Learn at least one file first')).toBeInTheDocument()
    expect(shell.navigate).not.toHaveBeenCalled()
  })

  it('goes Home from the back button without saving', async () => {
    const { user, styles, shell } = renderEditor({ view: makeView([makeFile()]) })
    await user.click(await screen.findByRole('button', { name: 'Home' }))
    expect(shell.navigate).toHaveBeenCalledWith('home')
    expect(styles.save).not.toHaveBeenCalled()
  })

  it('in edit mode enables Save changes only after the name changes', async () => {
    const { user, styles } = renderEditor({ view: makeView([makeFile()]), mode: 'edit' })
    const field = await screen.findByRole('textbox', { name: 'Style name' })
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    await user.type(field, ' 2')
    expect(save).toBeEnabled()
    await user.click(save)
    expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_1', name: 'Science KS3 2' })
    expect(styles.save).toHaveBeenCalled()
  })

  it('returns the summary to the toast name she typed', async () => {
    const { user } = renderEditor({
      view: makeView([makeFile()]),
      client: { save: () => ok({ style: makeSummary({ name: 'Renamed' }) }) }
    })
    const field = await screen.findByRole('textbox', { name: 'Style name' })
    await user.clear(field)
    await user.type(field, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save style' }))
    expect(await screen.findByText('Saved “Renamed”')).toBeInTheDocument()
  })
})

describe('first files create the draft', () => {
  it('pushes the typed name and default choice to the new style', async () => {
    const created = makeView(
      [makeFile({ id: 'n1', name: 'First.pdf', kind: 'pdf', status: 'waiting' })],
      {
        id: 'sty_new',
        name: 'My style',
        nameSource: 'auto'
      }
    )
    const { user, styles } = renderEditor({
      view: null,
      firstStyle: false,
      client: {
        createDraft: () => ok({ styleId: 'sty_new', added: 1, rejected: [] }),
        get: () => ok({ style: created })
      }
    })
    const field = screen.getByRole('textbox', { name: 'Style name' })
    await user.clear(field)
    await user.type(field, 'Chemistry')
    await user.click(screen.getByRole('checkbox', { name: 'Make this my default style' }))
    expect(styles.update).not.toHaveBeenCalled()
    drop(screen.getByRole('button', { name: /Add your PDFs or PowerPoints/ }), [pdf('First.pdf')])
    await waitFor(() =>
      expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_new', name: 'Chemistry' })
    )
    expect(styles.update).toHaveBeenCalledWith({ styleId: 'sty_new', isDefault: true })
    expect(screen.getByRole('textbox', { name: 'Style name' })).toHaveValue('Chemistry')
  })
})
