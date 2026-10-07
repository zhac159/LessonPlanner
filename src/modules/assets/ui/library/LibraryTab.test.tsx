import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ok } from '@shared/result'
import { LESSON, renderAssets } from '../testRender'
import { SAMPLE, makeDetail, makePage } from '../testSupport'

const card = (name: RegExp) => screen.findByRole('button', { name })

describe('Your assets (A1)', () => {
  it('shows skeletons first, then the cards with title, name, kind and lessons', async () => {
    let release: (v: ReturnType<typeof makePage>) => void = () => {}
    const gate = new Promise<ReturnType<typeof makePage>>((resolve) => (release = resolve))
    renderAssets({ assets: { list: () => gate } })
    expect(screen.getByRole('group', { name: 'Loading your assets' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your assets' })).toBeInTheDocument()
    release(makePage())
    const logo = await card(/School logo/)
    expect(logo).toHaveTextContent('school_logo')
    expect(logo).toHaveTextContent('Logo')
    expect(logo).toHaveTextContent('14 lessons')
    expect(await card(/Beaker/)).toHaveTextContent('Not used yet')
    expect(screen.getByRole('tab', { name: /Your assets · 5/ })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('selects the first card on load and fills the pane with its values', async () => {
    renderAssets()
    expect(await card(/School logo/)).toHaveAttribute('aria-pressed', 'true')
    const pane = await screen.findByRole('region', { name: 'School logo' })
    expect(within(pane).getByLabelText('Name in chat')).toHaveValue('school_logo')
    expect(within(pane).getByLabelText(/What it is/)).toHaveValue('A picture called school_logo.')
  })

  it('selects another card with a click and opens its details', async () => {
    const { user, client } = renderAssets()
    await user.click(await card(/Microscope/))
    expect(await screen.findByRole('region', { name: 'Microscope' })).toBeInTheDocument()
    expect(client.get).toHaveBeenLastCalledWith({ assetId: 'id-microscope_icon' })
  })

  it('says so when the library is empty and offers Upload and Find online', async () => {
    const { user } = renderAssets({
      assets: { list: () => makePage([], { libraryCount: 0 }) }
    })
    expect(await screen.findByRole('heading', { name: 'No assets yet' })).toBeInTheDocument()
    expect(
      screen.getByText(/let Slide Planner find the ones in your old decks/)
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Find online' }))
    expect(screen.getByRole('search', { name: 'Find images online' })).toBeInTheDocument()
  })

  it('shows an error with Retry and loads again', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('io')).mockResolvedValue(makePage())
    const { user } = renderAssets({ assets: { list } })
    expect(await screen.findByText(/Couldn’t load your assets/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await card(/School logo/)).toBeInTheDocument()
  })

  it('searches after a short pause and offers Clear search when nothing matches', async () => {
    const list = vi.fn((query?: { search?: string }) =>
      query?.search ? makePage([], { total: 0, libraryCount: 5 }) : makePage()
    )
    const { user } = renderAssets({ assets: { list } })
    await card(/School logo/)
    await user.type(screen.getByRole('searchbox', { name: 'Search your assets' }), 'zzz')
    expect(await screen.findByText(/Nothing matches “zzz”\./)).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'zzz' }))
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(await card(/School logo/)).toBeInTheDocument()
  })

  it('filters by kind and keeps the counts', async () => {
    const list = vi.fn(() => makePage())
    const { user } = renderAssets({ assets: { list } })
    await card(/School logo/)
    expect(screen.getByRole('button', { name: 'All · 5' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Icons' }))
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'icons' }))
    )
    expect(screen.queryByRole('button', { name: /Symbol cards/ })).not.toBeInTheDocument()
  })

  it('filters by where it came from', async () => {
    const list = vi.fn(() => makePage())
    const { user } = renderAssets({ assets: { list } })
    await card(/School logo/)
    await user.selectOptions(screen.getByLabelText('From'), 'uploaded')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ from: 'uploaded' }))
    )
  })

  it('focuses the search field when / is pressed', async () => {
    const { user } = renderAssets()
    await card(/School logo/)
    await user.keyboard('/')
    expect(screen.getByRole('searchbox', { name: 'Search your assets' })).toHaveFocus()
  })

  it('shows the banner for pending pictures and opens the review', async () => {
    const { user } = renderAssets({
      assets: {
        list: () =>
          makePage(SAMPLE, {
            pendingReview: { batchId: 'b1', found: 12, styleName: 'Science KS3' }
          }),
        'review:get': () => ({
          batches: [],
          candidates: [],
          found: 0,
          keeping: 0,
          leftOut: 0,
          stillReading: 0
        })
      }
    })
    expect(
      await screen.findByText('12 assets found while learning your Science KS3 style')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Review 12' }))
    expect(await screen.findByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
  })

  it('hides the banner when nothing is found', async () => {
    renderAssets({
      assets: {
        list: () =>
          makePage(SAMPLE, { pendingReview: { batchId: 'b1', found: 0, styleName: null } })
      }
    })
    await card(/School logo/)
    expect(screen.queryByRole('button', { name: /^Review/ })).not.toBeInTheDocument()
  })

  it('tells her about a tidied library once', async () => {
    renderAssets({ assets: { 'library:tidied': () => ({ recovered: 3, setAside: 1 }) } })
    expect(
      await screen.findByText(
        'Your library was tidied up. 3 assets recovered. 1 could not be read and was set aside.'
      )
    ).toBeInTheDocument()
  })

  it('pages: Show more loads the next 60', async () => {
    const list = vi.fn((query?: { cursor?: string | null }) =>
      query?.cursor
        ? makePage(SAMPLE.slice(3), { total: 5, cursor: null })
        : makePage(SAMPLE.slice(0, 3), { total: 5, cursor: 'c1' })
    )
    const { user } = renderAssets({ assets: { list } })
    await card(/School logo/)
    expect(screen.queryByRole('button', { name: /5-minute timer/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await card(/5-minute timer/)).toBeInTheDocument()
  })
})

describe('the detail pane', () => {
  it('shows a bad name in place and keeps the old one until a valid name is saved', async () => {
    const checkName = vi.fn(({ name }: { name: string }) =>
      name === 'beaker_icon'
        ? {
            ok: false as const,
            problem: 'taken' as const,
            message: 'You already have an asset called beaker_icon.'
          }
        : { ok: true as const, name }
    )
    const rename = vi.fn(({ name }: { name: string }) =>
      name === 'beaker_icon'
        ? {
            ok: false as const,
            code: 'invalid-input' as const,
            message: 'You already have an asset called beaker_icon.'
          }
        : ok({ asset: SAMPLE[0]! })
    )
    const { user } = renderAssets({ assets: { checkName, rename } })
    const field = await screen.findByLabelText('Name in chat')
    await user.clear(field)
    await user.type(field, 'beaker_icon')
    expect(
      await screen.findByText('You already have an asset called beaker_icon.')
    ).toBeInTheDocument()
    await user.tab()
    expect(rename).toHaveBeenCalledWith({ assetId: 'id-school_logo', name: 'beaker_icon' })
    expect(screen.getByLabelText('Name in chat')).toHaveAttribute('aria-invalid', 'true')
    await user.clear(screen.getByLabelText('Name in chat'))
    await user.type(screen.getByLabelText('Name in chat'), 'crest_logo{Enter}')
    await waitFor(() =>
      expect(rename).toHaveBeenLastCalledWith({ assetId: 'id-school_logo', name: 'crest_logo' })
    )
    await waitFor(() => expect(screen.queryByText(/already have an asset/)).not.toBeInTheDocument())
  })

  it('saves the description on blur and adds and removes tags', async () => {
    const update = vi.fn(() => ok({ asset: SAMPLE[0]! }))
    const { user } = renderAssets({ assets: { update } })
    const description = await screen.findByLabelText(/What it is/)
    await user.clear(description)
    await user.type(description, 'The crest')
    await user.tab()
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ assetId: 'id-school_logo', description: 'The crest' })
    )
    await user.type(screen.getByLabelText('Add a tag'), 'Title Slides{Enter}')
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ assetId: 'id-school_logo', tags: ['title slides'] })
    )
  })

  it('refreshes the card when the library changes', async () => {
    let name = 'school_logo'
    const { clients } = renderAssets({
      assets: { list: () => makePage([{ ...SAMPLE[0]!, name }, ...SAMPLE.slice(1)]) }
    })
    await card(/School logo/)
    name = 'crest_logo'
    clients.emit('assets', 'changed', { libraryCount: 5 })
    expect(await card(/crest_logo/)).toBeInTheDocument()
  })

  it('shows where an online picture came from and its credit', async () => {
    renderAssets({
      assets: {
        get: () =>
          ok({
            asset: makeDetail(SAMPLE[0]!, {
              source: { kind: 'online', provider: 'wikimedia', at: '2026-03-01T00:00:00Z' },
              licence: { id: 'cc-by-sa', label: 'CC BY-SA 4.0', requiresCredit: true },
              credit: {
                text: 'Volcano by A. Author, CC BY-SA 4.0, via Wikimedia Commons',
                provider: 'wikimedia',
                pageUrl: 'https://commons.example/x',
                inNotes: true
              } as never,
              sourceKind: 'online',
              foundIn: []
            })
          })
      }
    })
    expect(await screen.findByText('Wikimedia Commons')).toBeInTheDocument()
    expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument()
    expect(screen.getByText(/Volcano by A\. Author/)).toBeInTheDocument()
    expect(screen.getByText('Picked online')).toBeInTheDocument()
  })
})

describe('delete, replace and undo', () => {
  it('deletes an unused asset at once and Undo restores it', async () => {
    const remove = vi.fn(() => ok())
    const restore = vi.fn(() => ok())
    const { user } = renderAssets({ assets: { remove, restore } })
    await user.click(await card(/Beaker/))
    await user.click(await screen.findByRole('button', { name: 'Delete beaker_icon' }))
    expect(remove).toHaveBeenCalledWith({ assetId: 'id-beaker_icon' })
    expect(await screen.findByText('beaker_icon deleted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(restore).toHaveBeenCalledWith({ assetId: 'id-beaker_icon' })
  })

  it('asks first for an asset that lessons use, and Keep it does nothing', async () => {
    const remove = vi.fn(() => ok())
    const { user } = renderAssets({ assets: { remove } })
    await user.click(await screen.findByRole('button', { name: 'Delete school_logo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete school_logo?' })
    expect(dialog).toHaveTextContent('It’s used in 14 lessons. Those lessons keep their own copy.')
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }))
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete school_logo' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' })
    )
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ assetId: 'id-school_logo' }))
  })

  it('asks to delete when Delete is pressed on a focused card', async () => {
    const { user } = renderAssets()
    const beaker = await card(/Beaker/)
    beaker.focus()
    await user.keyboard('{Delete}')
    await waitFor(() => expect(screen.getByText('beaker_icon deleted')).toBeInTheDocument())
  })

  it('tells her when delete fails', async () => {
    const { user } = renderAssets({
      assets: {
        remove: () => ({ ok: false as const, code: 'io' as const, message: 'Disk is full.' })
      }
    })
    await user.click(await card(/Beaker/))
    await user.click(await screen.findByRole('button', { name: 'Delete beaker_icon' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Disk is full.')
  })

  it('replaces the file and says lessons keep the old one', async () => {
    const replaceFile = vi.fn(() => ok({ asset: SAMPLE[0]! }))
    const { user } = renderAssets({ assets: { replaceFile } })
    await user.click(await screen.findByRole('button', { name: 'Replace file' }))
    expect(
      await screen.findByText(
        'school_logo now uses the new file. Lessons that already use it keep the old one.'
      )
    ).toBeInTheDocument()
  })

  it('stays quiet when the replace dialog is cancelled', async () => {
    const { user } = renderAssets()
    await user.click(await screen.findByRole('button', { name: 'Replace file' }))
    expect(screen.queryByText(/now uses the new file/)).not.toBeInTheDocument()
  })
})

describe('Use in a lesson and where it is used', () => {
  const lessons = [
    LESSON('l1', 'Y8 Photosynthesis', '2026-03-03T00:00:00Z'),
    LESSON('l2', 'Y7 Cells', '2026-03-05T00:00:00Z')
  ]

  it('lists the newest lessons and opens the chosen one with the name in the composer', async () => {
    const { user, shell } = renderAssets({ lessons })
    await card(/School logo/)
    const use = await screen.findByRole('button', { name: 'Use in a lesson' })
    await waitFor(() => expect(use).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(use)
    const menu = await screen.findByRole('menu', { name: 'Which lesson?' })
    const items = within(menu).getAllByRole('menuitem')
    expect(items[0]).toHaveTextContent('Y7 Cells · 12 slides')
    expect(items[2]).toHaveTextContent('Start a new lesson')
    await user.click(items[1]!)
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'l1',
      composerText: '{{school_logo}} '
    })
  })

  it('starts a new lesson with the chip in the composer', async () => {
    const { user, shell } = renderAssets({ lessons })
    const use = await screen.findByRole('button', { name: 'Use in a lesson' })
    await waitFor(() => expect(use).not.toHaveAttribute('aria-disabled', 'true'))
    await user.click(use)
    await user.click(await screen.findByRole('menuitem', { name: 'Start a new lesson' }))
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'new-lesson',
      composerText: '{{school_logo}} '
    })
  })

  it('is off without any lesson and says why', async () => {
    renderAssets({ lessons: [] })
    const use = await screen.findByRole('button', { name: 'Use in a lesson' })
    expect(use).toHaveAttribute('aria-disabled', 'true')
    expect(use).toHaveAttribute('title', 'Make a lesson first')
  })

  it('lists the lessons and slides that use it and opens one', async () => {
    const usage = vi.fn(() =>
      ok({
        usage: {
          lessons: [{ lessonId: 'l1', title: 'Y8 Photosynthesis', slideNumbers: [1, 4] }],
          foundIn: []
        }
      })
    )
    const { user, shell } = renderAssets({ assets: { usage } })
    await user.click(await screen.findByRole('button', { name: '14 lessons' }))
    const item = await screen.findByRole('menuitem', { name: 'Y8 Photosynthesis · slides 1, 4' })
    await user.click(item)
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'l1'
    })
  })
})

describe('uploading', () => {
  it('opens the review for the batch the dialog started', async () => {
    const pick = vi.fn(() => ok({ batchId: 'b9', accepted: 2, rejected: [] }))
    const { user } = renderAssets({ assets: { 'add:pick': pick } })
    await card(/School logo/)
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
    expect(screen.getByText(/Looking at 2 files/)).toBeInTheDocument()
  })

  it('stays put when the dialog is cancelled', async () => {
    const { user } = renderAssets({
      assets: { 'add:pick': () => ok({ cancelled: true as const }) }
    })
    await card(/School logo/)
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(screen.queryByRole('heading', { name: 'Check what I found' })).not.toBeInTheDocument()
  })

  it('says what was refused and does not open the review when nothing was taken', async () => {
    const { user } = renderAssets({
      assets: {
        'add:pick': () =>
          ok({
            batchId: 'b9',
            accepted: 0,
            rejected: [{ name: 'notes.docx', reason: 'type' as const }]
          })
      }
    })
    await card(/School logo/)
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    expect(await screen.findByText(/notes\.docx isn’t a picture/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Check what I found' })).not.toBeInTheDocument()
  })
})
