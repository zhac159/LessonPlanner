/** A6: the "Picture habits" and "Assets I found" cards inside "What I've learned so far", in every state. */
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AssetChip } from '@shared/contracts/assets'
import type { StyleProfileView } from '@shared/contracts/style-library'
import { designFiles, makeFile, makeProfileView, makeView, progressOf } from '../testSupport'
import { renderEditor } from './testHarness'

const chip = (name: string): AssetChip => ({
  assetId: `id_${name}`,
  name,
  kind: 'logo',
  thumbDataUrl: null,
  removed: false
})

const pictures = (over: Partial<StyleProfileView> = {}): Partial<StyleProfileView> => ({
  pictureHabits: [
    'A picture on the right of most content slides, about a third of the slide',
    '{{school_logo}} in the top-right corner on title slides'
  ],
  assetsFound: {
    found: 12,
    suggested: 9,
    saved: 0,
    batchId: 'rvb_1',
    preview: [
      'school_logo',
      'do_now_banner',
      'owl_mascot',
      'beaker_icon',
      'timer_icon',
      'plant_cell'
    ].map(chip)
  },
  ...over
})

const viewWith = (profile: Partial<StyleProfileView> | null, files = designFiles()) => {
  const view = makeView(files)
  return { ...view, profile: profile ? makeProfileView(profile) : null }
}

describe('StyleEditor: picture habits and assets found (A6)', () => {
  it('shows both cards under the six learned cards, above "Anything I got wrong?"', async () => {
    renderEditor({ view: viewWith(pictures()) })
    const habits = await screen.findByRole('region', { name: 'Picture habits' })
    const assets = screen.getByRole('region', { name: 'Assets I found' })
    const correction = screen.getByRole('textbox', { name: 'Anything I got wrong?' })
    expect(within(habits).getByText('school_logo')).toBeInTheDocument()
    expect(within(assets).getByText('12 found · 9 suggested')).toBeInTheDocument()
    expect(within(assets).getAllByText(/_(logo|banner|mascot|icon)|plant_cell/)).not.toHaveLength(0)
    const order = [habits, assets, correction].map((el) => el.compareDocumentPosition(correction))
    expect(order[0] & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(order[1] & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // eight files, so no "Based on 1 deck" caption
    expect(screen.queryByText(/Based on 1 deck/)).toBeNull()
  })

  it('"Review assets" opens the Assets review with this style’s batch', async () => {
    const { shell } = renderEditor({ view: viewWith(pictures()) })
    await userEvent.click(await screen.findByRole('button', { name: 'Review assets' }))
    expect(shell.navigate).toHaveBeenCalledWith('assets', { kind: 'review', batchId: 'rvb_1' })
  })

  it('after she keeps them the pill reads "9 saved to Your assets" and the button opens the library', async () => {
    const found = pictures().assetsFound!
    const { shell } = renderEditor({
      view: viewWith(pictures({ assetsFound: { ...found, saved: 9, batchId: null } }))
    })
    expect(await screen.findByText('9 saved to Your assets')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open Assets' }))
    expect(shell.navigate).toHaveBeenCalledWith('assets', { kind: 'library' })
  })

  it('shows skeleton rows before the first file is read, and no assets card', async () => {
    renderEditor({ view: viewWith(null, [makeFile({ status: 'reading' })]) })
    const habits = await screen.findByRole('region', { name: 'Picture habits' })
    expect(habits).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('region', { name: 'Assets I found' })).toBeNull()
  })

  it('keeps showing skeleton rows while the pictures of learned files are being looked at', async () => {
    const files = [makeFile({ id: 'a' }), makeFile({ id: 'b', status: 'reading' })]
    renderEditor({ view: viewWith({ pictureHabits: [], assetsFound: null }, files) })
    expect(await screen.findByRole('region', { name: 'Picture habits' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.queryByRole('region', { name: 'Assets I found' })).toBeNull()
  })

  it('says "No pictures found in these files." and hides the assets card when there are none', async () => {
    renderEditor({
      view: viewWith({
        pictureHabits: [],
        assetsFound: { found: 0, suggested: 0, saved: 0, batchId: null, preview: [] }
      })
    })
    expect(await screen.findByText('No pictures found in these files.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Assets I found' })).toBeNull()
  })

  it('a single deck gets the "Based on 1 deck" caption', async () => {
    renderEditor({ view: viewWith(pictures(), [makeFile()]) })
    expect(
      await screen.findByText('Based on 1 deck. More decks make this surer.')
    ).toBeInTheDocument()
  })

  it('fills in live from progress events as the pictures are looked at', async () => {
    const files = [makeFile({ id: 'a' })]
    const { clients } = renderEditor({
      view: viewWith({ pictureHabits: [], assetsFound: null }, [
        makeFile({ id: 'a', status: 'reading' })
      ])
    })
    await screen.findByRole('region', { name: 'Picture habits' })
    act(() => {
      clients.emit('style-library', 'progress', {
        styleId: 'sty_1',
        file: files[0],
        progress: progressOf(files, { stage: 'pictures' }),
        partialProfile: makeProfileView(pictures())
      })
    })
    expect(await screen.findByText('Looking at your pictures…')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Assets I found' })).toBeInTheDocument()
    expect(screen.getByText('12 found · 9 suggested')).toBeInTheDocument()
  })

  it('old styles without picture fields still render: the picture card just says there are none', async () => {
    const { pictureHabits: _a, assetsFound: _b, ...old } = makeProfileView()
    renderEditor({
      view: { ...makeView([makeFile()]), profile: old as StyleProfileView }
    })
    expect(await screen.findByText('No pictures found in these files.')).toBeInTheDocument()
  })
})
