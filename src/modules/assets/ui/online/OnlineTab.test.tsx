import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OnlineQuery, OnlineSearchResult } from '@shared/contracts/assets'
import { fail, ok } from '@shared/result'
import { renderAssets, type RenderAssetsOptions } from '../testRender'
import { makeResult, makeSummary } from '../testSupport'

const RESULTS = [
  makeResult('Volcano cross-section'),
  makeResult('Eruption at night', {
    provider: 'openverse',
    providerLabel: 'Openverse',
    licence: { id: 'cc-by', label: 'CC BY', requiresCredit: true }
  }),
  makeResult('Cartoon volcano', {
    providerLabel: 'Openverse',
    licence: { id: 'cc0', label: 'CC0', requiresCredit: false }
  }),
  makeResult('Lava flow', {
    licence: { id: 'cc-by-nc', label: 'CC BY-NC', requiresCredit: true }
  })
]

const found = (over: Partial<OnlineSearchResult> = {}): OnlineSearchResult => ({
  results: RESULTS,
  total: 48,
  page: 1,
  hasMore: false,
  providers: [
    { provider: 'wikimedia', ok: true },
    { provider: 'openverse', ok: true }
  ],
  ...over
})

async function openOnline(options: RenderAssetsOptions = {}) {
  const search = vi.fn((_query: OnlineQuery) => ok(found()))
  const rendered = renderAssets({
    ...options,
    assets: { 'online:search': search, ...options.assets },
    shell: { intent: { kind: 'online' } }
  })
  await screen.findByRole('search', { name: 'Find images online' })
  return { ...rendered, search }
}

async function searchFor(user: ReturnType<typeof renderAssets>['user'], text = 'volcano diagram') {
  await user.type(screen.getByRole('searchbox', { name: 'Search free image libraries' }), text)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

describe('Find online (A9)', () => {
  it('opens on the Find online tab with the first-visit help and the free filter on', async () => {
    await openOnline()
    expect(screen.getByRole('tab', { name: 'Find online' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('heading', { name: 'Search free image libraries' })).toBeInTheDocument()
    expect(screen.getByText(/Try “volcano diagram” or “cave painting”/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Free to use in lessons/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Any' })).toBeChecked()
  })

  it('searches, shows source and licence on each card and selects the first', async () => {
    const { user, search } = await openOnline()
    await searchFor(user)
    expect(search).toHaveBeenCalledWith({
      query: 'volcano diagram',
      kind: 'any',
      freeToUse: true,
      page: 1
    })
    const first = await screen.findByRole('button', {
      name: 'Volcano cross-section, Wikimedia Commons, CC BY-SA 4.0'
    })
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('48 results from free image libraries')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Eruption at night, Openverse, CC BY/ })
    ).toBeInTheDocument()
    const pane = screen.getByRole('region', { name: 'Volcano cross-section' })
    expect(within(pane).getByText('1600 × 1200')).toBeInTheDocument()
    expect(within(pane).getByLabelText('Name in chat')).toHaveValue('volcano_cross_section')
    expect(
      within(pane).getByText(/This one needs a credit\. I'll add it to the speaker notes/)
    ).toBeInTheDocument()
  })

  it('searches on Enter too, and not for an empty box', async () => {
    const { user, search } = await openOnline()
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(search).not.toHaveBeenCalled()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search free image libraries' }),
      'cave painting{Enter}'
    )
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'cave painting' }))
  })

  it('searches straight away for the query of an intent', async () => {
    const search = vi.fn((_query: OnlineQuery) => ok(found()))
    renderAssets({
      assets: { 'online:search': search },
      shell: { intent: { kind: 'online', query: 'volcano' } }
    })
    expect(await screen.findByText('48 results from free image libraries')).toBeInTheDocument()
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'volcano' }))
    expect(screen.getByRole('searchbox', { name: 'Search free image libraries' })).toHaveValue(
      'volcano'
    )
  })

  it('searches again when a chip changes', async () => {
    const { user, search } = await openOnline()
    await searchFor(user)
    await screen.findByText('48 results from free image libraries')
    await user.click(screen.getByRole('radio', { name: 'Photos' }))
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith({
        query: 'volcano diagram',
        kind: 'photo',
        freeToUse: true,
        page: 1
      })
    )
    await user.click(screen.getByRole('button', { name: /Free to use in lessons/ }))
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ freeToUse: false }))
    )
  })

  it('shows the amber check-licence notice for an NC picture and the no-credit notice for CC0', async () => {
    const { user } = await openOnline()
    await searchFor(user)
    await user.click(await screen.findByRole('button', { name: /Cartoon volcano/ }))
    expect(screen.getByText('No credit needed for this one.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lava flow/ }))
    expect(
      screen.getByText(
        "This licence doesn't cover every use. Check it before you share your slides."
      )
    ).toBeInTheDocument()
  })

  it('builds a selection with the ticks and adds several through the review', async () => {
    const add = vi.fn(() => ok({ batchId: 'b5' }))
    const { user } = await openOnline({ assets: { 'online:add': add } })
    await searchFor(user)
    await user.click(await screen.findByRole('checkbox', { name: 'Select Volcano cross-section' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Eruption at night' }))
    await user.click(screen.getByRole('checkbox', { name: 'Select Cartoon volcano' }))
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.getByText('I’ll name them and keep the credits for you')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add 3 to Your assets' }))
    expect(add).toHaveBeenCalledWith({
      items: [
        { id: 'r-Volcano cross-section' },
        { id: 'r-Eruption at night' },
        { id: 'r-Cartoon volcano' }
      ],
      mode: 'review'
    })
    expect(await screen.findByRole('heading', { name: 'Check what I found' })).toBeInTheDocument()
  })

  it('clears the selection', async () => {
    const { user } = await openOnline()
    await searchFor(user)
    await user.click(await screen.findByRole('checkbox', { name: 'Select Lava flow' }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument()
  })

  it('adds the selected one at once, keeping the proposed name, with Undo', async () => {
    const add = vi.fn(() => ok({ added: [makeSummary('volcano_cross_section')] }))
    const remove = vi.fn(() => ok())
    const { user } = await openOnline({ assets: { 'online:add': add, remove } })
    await searchFor(user)
    await user.click(await screen.findByRole('button', { name: 'Add to Your assets' }))
    expect(add).toHaveBeenCalledWith({
      items: [{ id: 'r-Volcano cross-section', name: undefined }],
      mode: 'direct'
    })
    expect(
      await screen.findByText('volcano_cross_section added to Your assets')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(remove).toHaveBeenCalledWith({ assetId: 'id-volcano_cross_section' })
  })

  it('sends a name she typed and shows a refused one under the field', async () => {
    const add = vi.fn(({ items }: { items: Array<{ name?: string }> }) =>
      items[0]!.name === 'beaker_icon'
        ? fail('invalid-input', 'You already have an asset called beaker_icon.')
        : ok({ added: [makeSummary('volcano_pic')] })
    )
    const { user } = await openOnline({ assets: { 'online:add': add } })
    await searchFor(user)
    const name = await screen.findByLabelText('Name in chat')
    await user.clear(name)
    await user.type(name, 'beaker_icon')
    await user.click(screen.getByRole('button', { name: 'Add to Your assets' }))
    expect(
      await screen.findByText('You already have an asset called beaker_icon.')
    ).toBeInTheDocument()
    await user.clear(name)
    await user.type(name, 'volcano_pic')
    await user.click(screen.getByRole('button', { name: 'Add to Your assets' }))
    await waitFor(() =>
      expect(add).toHaveBeenLastCalledWith(
        expect.objectContaining({ items: [{ id: 'r-Volcano cross-section', name: 'volcano_pic' }] })
      )
    )
  })

  it('keeps main’s refusal under the field when the live check of that name answers later', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const checkName = vi.fn(async ({ name }: { name: string }) => {
      await gate
      return { ok: true as const, name }
    })
    const add = vi.fn(() => fail('invalid-input', 'You already have an asset called beaker_icon.'))
    const { user } = await openOnline({ assets: { 'online:add': add, checkName } })
    await searchFor(user)
    const name = await screen.findByLabelText('Name in chat')
    await user.clear(name)
    await user.type(name, 'beaker_icon')
    await waitFor(() => expect(checkName).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Add to Your assets' }))
    expect(
      await screen.findByText('You already have an asset called beaker_icon.')
    ).toBeInTheDocument()
    // the check that was still in flight now says "fine": it is about the same name, but the refusal is newer
    release()
    await act(async () => {
      await gate
    })
    expect(screen.getByText('You already have an asset called beaker_icon.')).toBeInTheDocument()
    // a different name is a new question
    await user.clear(name)
    await user.type(name, 'volcano_pic')
    expect(
      screen.queryByText('You already have an asset called beaker_icon.')
    ).not.toBeInTheDocument()
  })

  it('opens the source page in the browser', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { user } = await openOnline()
    await searchFor(user)
    await user.click(await screen.findByRole('button', { name: /Open source page/ }))
    expect(open).toHaveBeenCalledWith('https://commons.example/volcano', '_blank', 'noopener')
    open.mockRestore()
  })

  it('says nothing was found, and suggests unticking the filter only while it is on', async () => {
    const { user } = await openOnline({
      assets: { 'online:search': () => ok(found({ results: [], total: 0 })) }
    })
    await searchFor(user, 'zzzz')
    expect(
      await screen.findByText(
        'Nothing found for “zzzz”. Try fewer or simpler words, or untick Free to use in lessons.'
      )
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Free to use in lessons/ }))
    expect(
      await screen.findByText('Nothing found for “zzzz”. Try fewer or simpler words.')
    ).toBeInTheDocument()
  })

  it('shows the busy message with Try again', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(fail('io', 'The image libraries are busy. Try again in a minute.'))
      .mockResolvedValue(ok(found()))
    const { user } = await openOnline({ assets: { 'online:search': search } })
    await searchFor(user)
    expect(
      await screen.findByText('The image libraries are busy. Try again in a minute.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('48 results from free image libraries')).toBeInTheDocument()
  })

  it('shows skeletons while searching', async () => {
    let release: (v: ReturnType<typeof ok<OnlineSearchResult>>) => void = () => {}
    const gate = new Promise<ReturnType<typeof ok<OnlineSearchResult>>>((r) => (release = r))
    const { user } = await openOnline({ assets: { 'online:search': () => gate } })
    await searchFor(user)
    expect(await screen.findByRole('group', { name: 'Searching' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    release(ok(found()))
    expect(await screen.findByText('48 results from free image libraries')).toBeInTheDocument()
  })

  it('names a library that did not answer and still shows the others', async () => {
    const { user } = await openOnline({
      assets: {
        'online:search': () =>
          ok(
            found({
              providers: [
                { provider: 'wikimedia', ok: true },
                { provider: 'openverse', ok: false }
              ]
            })
          )
      }
    })
    await searchFor(user)
    expect(
      await screen.findByText('Openverse didn’t answer. Showing the others.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Volcano cross-section/ })).toBeInTheDocument()
  })

  it('shows more pages up to five', async () => {
    const search = vi.fn((query: OnlineQuery) =>
      ok(
        found({
          results: [makeResult(`Page ${query.page} picture`)],
          page: query.page,
          hasMore: true
        })
      )
    )
    const { user } = await openOnline({ assets: { 'online:search': search } })
    await searchFor(user)
    for (let page = 2; page <= 5; page++) {
      await user.click(await screen.findByRole('button', { name: 'Show more' }))
      expect(
        await screen.findByRole('button', { name: new RegExp(`Page ${page} picture`) })
      ).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })
})
