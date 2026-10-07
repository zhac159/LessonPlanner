import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Deck, ImageElement } from '@shared/deck/types'
import { fixtureDeck } from '@shared/deck/testing'
import { fail, ok } from '@shared/result'
import { ASSETS, type AssetsApi } from '@shared/contracts/assets'
import { SETTINGS } from '@shared/contracts/settings'
import { clearOnlineCache } from '../assets/hooks/useOnlineSearch'
import { fakeAssets, fakePlaceAsset, fakeSettings, LIBRARY, makeProgress } from '../assets/testing'
import { FakeLesson, setupEditor, type EditorSetup } from './testing'
import { resetStubs, seen } from './testStubs'

vi.mock('../chat', async () => (await import('./testStubs')).chatModule)
vi.mock('../circle', async () => (await import('./testStubs')).circleModule)

beforeEach(() => {
  resetStubs()
  clearOnlineCache()
  window.localStorage.clear()
})

const spot = (id: string, description: string): ImageElement => ({
  id,
  type: 'image',
  x: 1000,
  y: 300,
  w: 600,
  h: 450,
  fit: 'cover',
  alt: description,
  placeholder: { description }
})

/** The photosynthesis fixture with two more spots: slides 1, 2 and 3 each have one. */
function threeSpots(): Deck {
  const deck = fixtureDeck()
  deck.slides[0]!.elements.push(spot('s1-spot', 'A map of the school'))
  deck.slides[1]!.elements.push(spot('s2-spot', 'A pupil with a microscope'))
  return deck
}

interface Options extends EditorSetup {
  deck?: Deck
  assets?: Parameters<typeof fakeAssets>[1]
  library?: Parameters<typeof fakeAssets>[0]
  uses?: number
}

const assetMocks = (view: { clients: { client(id: string): unknown } }) =>
  view.clients.client('assets') as unknown as { [K in keyof AssetsApi]: Mock }

async function open(options: Options = {}) {
  const lesson = options.lesson ?? new FakeLesson(options.deck)
  const view = setupEditor({
    ...options,
    lesson,
    deckBuilder: {
      placeAsset: fakePlaceAsset(lesson),
      ...options.deckBuilder
    },
    clients: {
      [ASSETS]: fakeAssets(options.library ?? LIBRARY, options.assets),
      [SETTINGS]: fakeSettings(options.uses ?? 0)
    }
  })
  await screen.findByRole('navigation', { name: 'Slides' })
  return { ...view, lesson }
}

const sheet = () => screen.findByRole('dialog', { name: 'Fill this picture spot' })
const filmstrip = () => within(screen.getByRole('navigation', { name: 'Slides' }))
const placeButton = () => screen.getByRole('button', { name: /^Place it/ })

describe('A12: picture spots on the stage, the filmstrip and in the chat', () => {
  it('draws the spot on the stage as a button and counts the spots for the chat', async () => {
    const view = await open()
    await view.user.click(filmstrip().getByRole('button', { name: /^Slide 3(:|$)/ }))
    expect(
      await screen.findByRole('button', { name: 'Fill picture spot: Photo: leaf in sunlight' })
    ).toBeInTheDocument()
    expect(await screen.findByText('stub spots 1')).toBeInTheDocument()
    expect(seen.chat?.spots?.count).toBe(1)
  })

  it('shows a dashed badge on every slide with spots and opens the first spot of that slide', async () => {
    const view = await open({ deck: threeSpots() })
    expect(
      filmstrip().getByRole('button', { name: 'Slide 1 has 1 picture spot' })
    ).toBeInTheDocument()
    expect(
      filmstrip().getByRole('button', { name: 'Slide 3 has 1 picture spot' })
    ).toBeInTheDocument()
    await view.user.click(filmstrip().getByRole('button', { name: 'Slide 2 has 1 picture spot' }))
    const dialog = await sheet()
    expect(
      within(dialog).getByText('“A pupil with a microscope” · slide 2 · 2 of 3')
    ).toBeInTheDocument()
    expect(seen.chat?.currentSlideId).toBe('s2')
  })

  it('"Fill the first one" opens spot 1 of 3 and selects its slide', async () => {
    const view = await open({ deck: threeSpots() })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 3' }))
    const dialog = await sheet()
    expect(within(dialog).getByText('“A map of the school” · slide 1 · 1 of 3')).toBeInTheDocument()
    expect(seen.chat?.currentSlideId).toBe('s1')
  })

  it('clicking a spot on the stage opens it', async () => {
    const view = await open()
    await view.user.click(filmstrip().getByRole('button', { name: /^Slide 3(:|$)/ }))
    await view.user.click(
      await screen.findByRole('button', { name: 'Fill picture spot: Photo: leaf in sunlight' })
    )
    expect(await sheet()).toBeInTheDocument()
  })

  it('is view-only while Claude is working: spots are not buttons then', async () => {
    await open({ view: { runningJob: { jobId: 'j', kind: 'chat', messageId: 'm' } } })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Fill picture spot/ })).not.toBeInTheDocument()
    )
  })
})

describe('A13: fill a picture spot from "Find online"', () => {
  it('searches once with the spot’s words, previews the first result in the spot and places it', async () => {
    const view = await open()
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    expect(
      within(dialog).getByText('“Photo: leaf in sunlight” · slide 3 · 1 of 1')
    ).toBeInTheDocument()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    const search = assetMocks(view)
    await within(dialog).findByRole('button', { name: /^Leaf 6,/ })
    expect(search['online:search']).toHaveBeenCalledTimes(1)
    expect(search['online:search']).toHaveBeenCalledWith({
      query: 'Photo: leaf in sunlight',
      kind: 'any',
      freeToUse: true,
      page: 1
    })
    expect(within(dialog).getAllByRole('button', { name: /, Openverse, / })).toHaveLength(6)
    expect(within(dialog).getByRole('button', { name: /^Leaf 1,/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(within(dialog).getByText('leaf_in_sunlight')).toBeInTheDocument()
    // the picture is previewed in the spot, filling it (the mockup's choice)
    expect(document.querySelector('.stage-preview')).toHaveAttribute('data-fit', 'cover')
    expect(within(dialog).getByRole('radio', { name: 'Fill the spot' })).toBeChecked()

    await view.user.click(within(dialog).getByRole('radio', { name: 'Fit inside the spot' }))
    expect(document.querySelector('.stage-preview')).toHaveAttribute('data-fit', 'contain')
    await view.user.click(within(dialog).getByRole('radio', { name: 'Fill the spot' }))

    await view.user.click(placeButton())
    await waitFor(() => expect(view.db.placeAsset).toHaveBeenCalledTimes(1))
    expect(view.db.placeAsset.mock.calls[0]![0]).toMatchObject({
      lessonId: 'les_1',
      slideId: 's3',
      source: { kind: 'online', resultId: 'res_1', name: 'leaf_in_sunlight' },
      target: { kind: 'spot', elementId: 's3-photo' },
      fit: 'fill'
    })
    // one ChangeSet: the spot became a picture, keeping its placeholder, with the credit in the notes
    const slide = view.lesson.deck.slides[2]!
    const filled = slide.elements.find((e) => e.id === 's3-photo') as ImageElement
    expect(filled.assetId).toBe('ast_leaf_in_sunlight')
    expect(filled.placeholder).toBeDefined()
    expect(slide.notes).toContain('Picture credit')
    // the last spot: the sheet closes with the toast, the counts drop to zero
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Fill this picture spot' })
      ).not.toBeInTheDocument()
    )
    expect(await screen.findByText('All picture spots are filled.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Fill picture spot/ })).not.toBeInTheDocument()
    expect(seen.chat?.spots?.count).toBe(0)
  })

  it('works through the snapshot: "Place it · next spot", Skip, and closing after the last', async () => {
    const view = await open({ deck: threeSpots() })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 3' }))
    let dialog = await sheet()
    expect(placeButton()).toHaveTextContent('Place it · next spot')
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    await within(dialog).findByRole('button', { name: /^Leaf 6,/ })
    await view.user.click(placeButton())
    // spot 1 is filled; the live count is 2 but the sheet is still "of 3" and now on spot 2
    await waitFor(() =>
      expect(screen.getByText('“A pupil with a microscope” · slide 2 · 2 of 3')).toBeInTheDocument()
    )
    expect(seen.chat?.spots?.count).toBe(2)
    expect(seen.chat?.currentSlideId).toBe('s2')

    dialog = await sheet()
    await view.user.click(within(dialog).getByRole('button', { name: 'Skip' }))
    expect(
      await screen.findByText('“Photo: leaf in sunlight” · slide 3 · 3 of 3')
    ).toBeInTheDocument()
    expect(seen.chat?.spots?.count).toBe(2)

    await view.user.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Fill this picture spot' })
      ).not.toBeInTheDocument()
    )
    expect(view.lesson.deck.slides[1]!.elements.some((e) => e.id === 's2-spot')).toBe(true)
  })

  it('the last empty spot says just "Place it"', async () => {
    const view = await open()
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    await sheet()
    expect(placeButton()).toHaveTextContent(/^Place it$/)
  })

  it('Esc closes the sheet and keeps the spot; focus goes back to where it was', async () => {
    const view = await open()
    const spotButton = await screen.findByRole('button', { name: 'stub spots 1' })
    spotButton.focus()
    await view.user.click(spotButton)
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Make one' }))
    await view.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Fill this picture spot' })).not.toBeInTheDocument()
    expect(seen.chat?.spots?.count).toBe(1)
    expect(view.db.placeAsset).not.toHaveBeenCalled()
    await waitFor(() => expect(spotButton).toHaveFocus())
  })

  it('tells her when the picture could not be fetched and stays open', async () => {
    const view = await open({
      deckBuilder: { placeAsset: () => fail('network', 'offline') }
    })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    await within(dialog).findByRole('button', { name: /^Leaf 6,/ })
    await view.user.click(placeButton())
    expect(
      await within(dialog).findByText('Couldn’t get that picture. Try another or search again.')
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Fill this picture spot' })).toBeInTheDocument()
  })

  it('lets her rename the saved asset with the pencil, and checks the name', async () => {
    const view = await open({
      assets: {
        checkName: ({ name }) =>
          name === 'taken'
            ? { ok: false, problem: 'taken', message: 'You already have an asset called taken.' }
            : { ok: true, name }
      }
    })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    await within(dialog).findByRole('button', { name: /^Leaf 6,/ })
    await view.user.click(within(dialog).getByRole('button', { name: 'Change the saved name' }))
    const field = within(dialog).getByRole('textbox', { name: 'Name in chat' })
    await view.user.clear(field)
    await view.user.type(field, 'taken')
    expect(
      await within(dialog).findByText('You already have an asset called taken.')
    ).toBeInTheDocument()
    await view.user.clear(field)
    await view.user.type(field, 'sunny_leaf')
    await view.user.click(placeButton())
    await waitFor(() => expect(view.db.placeAsset).toHaveBeenCalled())
    expect(view.db.placeAsset.mock.calls[0]![0].source).toMatchObject({ name: 'sunny_leaf' })
  })

  it('searches again with other words and the free-to-use chip', async () => {
    const view = await open()
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    await within(dialog).findByRole('button', { name: /^Leaf 6,/ })
    const field = within(dialog).getByRole('searchbox', { name: 'Search free image libraries' })
    await view.user.clear(field)
    await view.user.type(field, 'sunflower{Enter}')
    const assets = assetMocks(view)
    await waitFor(() => expect(assets['online:search']).toHaveBeenCalledTimes(2))
    expect(assets['online:search'].mock.calls[1]![0]).toMatchObject({
      query: 'sunflower',
      freeToUse: true
    })
    await view.user.click(within(dialog).getByRole('button', { name: /Free to use in lessons/ }))
    await waitFor(() => expect(assets['online:search']).toHaveBeenCalledTimes(3))
    expect(assets['online:search'].mock.calls[2]![0]).toMatchObject({ freeToUse: false })
  })

  it('says so when the search finds nothing or fails', async () => {
    const view = await open({
      assets: { 'online:search': () => fail('network', 'No internet') }
    })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Find online' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No internet')
  })
})

describe('A13: your assets and make one', () => {
  it('suggests assets for the spot and places the chosen one from the library', async () => {
    const view = await open()
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    expect(await within(dialog).findByText('SUGGESTED FOR THIS SPOT')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.stage-preview')).not.toBeNull())
    await view.user.click(within(dialog).getAllByRole('button', { name: 'plant_cell_diagram' })[0]!)
    await view.user.click(placeButton())
    await waitFor(() => expect(view.db.placeAsset).toHaveBeenCalled())
    expect(view.db.placeAsset.mock.calls[0]![0]).toMatchObject({
      source: { kind: 'library', assetId: 'ast_plant_cell_diagram' },
      target: { kind: 'spot', elementId: 's3-photo' }
    })
  })

  it('"Find online" in an empty library goes to the online tab', async () => {
    const view = await open({ library: [], assets: { suggest: () => ok({ assets: [] }) } })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    expect(await within(dialog).findByText("You don't have any assets yet.")).toBeInTheDocument()
    await view.user.click(within(dialog).getByRole('button', { name: 'Find online' }))
    expect(within(dialog).getByRole('tab', { name: 'Find online' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('makes versions with the spot’s words and places the chosen one as "Use version 2"', async () => {
    const view = await open()
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Make one' }))
    const prompt = await within(dialog).findByRole('textbox', { name: 'What should it be?' })
    expect(prompt).toHaveValue('Photo: leaf in sunlight')
    await view.user.click(within(dialog).getByRole('button', { name: 'Make 4' }))
    const client = assetMocks(view)
    await waitFor(() => expect(client['make:start']).toHaveBeenCalled())
    expect(client['make:start'].mock.calls[0]![0]).toMatchObject({
      prompt: 'Photo: leaf in sunlight',
      versions: 4
    })
    act(() => view.clients.emit('assets', 'make:progress', makeProgress()))
    const radios = await within(dialog).findAllByRole('radio', { name: /Version \d/ })
    await view.user.click(radios[1]!)
    await view.user.click(within(dialog).getByRole('button', { name: 'Use version 2' }))
    await waitFor(() => expect(view.db.placeAsset).toHaveBeenCalled())
    expect(view.db.placeAsset.mock.calls[0]![0].source).toMatchObject({
      kind: 'made',
      jobId: 'job_make',
      version: 2
    })
  })

  it('explains when there is no way to make pictures, and when only drawings are possible', async () => {
    const view = await open({
      assets: {
        'make:mode': () => ({ mode: 'unavailable', modelLabel: null, perPictureUsd: null })
      }
    })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Make one' }))
    expect(
      (
        await within(dialog).findAllByText(
          'Making pictures needs your Claude key. Connect Claude in Settings first.'
        )
      ).length
    ).toBeGreaterThan(0)
  })

  it('offers the picture maker in Settings when only drawings are possible', async () => {
    const view = await open({
      assets: { 'make:mode': () => ({ mode: 'vector', modelLabel: null, perPictureUsd: null }) }
    })
    await view.user.click(await screen.findByRole('button', { name: 'stub spots 1' }))
    const dialog = await sheet()
    await view.user.click(within(dialog).getByRole('tab', { name: 'Make one' }))
    await view.user.click(
      await within(dialog).findByRole('button', { name: 'Add a picture maker' })
    )
    expect(view.shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })
})

describe('A11: add an asset to a circled region', () => {
  const region = {
    id: 'r1',
    n: 1,
    slideId: 's3',
    // a loop around the photo spot on slide 3
    path: [
      [1100, 280],
      [1830, 280],
      [1830, 820],
      [1100, 820]
    ] as Array<[number, number]>,
    bbox: { x: 1100, y: 280, w: 730, h: 540 },
    targetElementIds: ['s3-photo']
  }
  const regionSheet = () => screen.findByRole('dialog', { name: 'Add to region 1' })

  async function circled() {
    const view = await open()
    act(() => seen.circle!.onAddRegion(region))
    await waitFor(() => expect(seen.chat?.regions).toHaveLength(1))
    act(() => seen.circle!.onAddAsset!('r1'))
    return { ...view, dialog: await regionSheet() }
  }

  it('opens "Add to region 1" with the suggestions, the first one chosen and drawn fitted on the stage', async () => {
    const { dialog } = await circled()
    expect(
      within(dialog).getByText('Pick an asset. I’ll scale it to fit your circle.')
    ).toBeInTheDocument()
    expect(await within(dialog).findByText('SUGGESTED FOR THIS SLIDE')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.stage-preview')).not.toBeNull())
    const box = document.querySelector('.stage-preview') as HTMLElement
    expect(within(box).getByRole('status')).toHaveTextContent(
      'leaf_cross_section · fitted to region 1'
    )
    expect(box).toHaveAttribute('data-fit', 'contain')
    expect(parseFloat(box.style.left)).toBeGreaterThan((1100 / 1920) * 100 - 0.01)
    expect(parseFloat(box.style.left) + parseFloat(box.style.width)).toBeLessThan(
      (1830 / 1920) * 100
    )
  })

  it('Fill the circle uses the loop’s bounding box, cropped', async () => {
    const { dialog, user } = await circled()
    await waitFor(() => expect(document.querySelector('.stage-preview')).not.toBeNull())
    await user.click(within(dialog).getByRole('radio', { name: 'Fill the circle' }))
    const box = document.querySelector('.stage-preview') as HTMLElement
    expect(box).toHaveAttribute('data-fit', 'cover')
    expect(within(box).getByRole('status')).toHaveTextContent(
      'leaf_cross_section · filling region 1'
    )
    expect(parseFloat(box.style.left)).toBeCloseTo((1100 / 1920) * 100, 1)
    expect(parseFloat(box.style.width)).toBeCloseTo((730 / 1920) * 100, 1)
  })

  it('offers to replace the photo underneath, ticked, and "Place it" updates it in one undo step', async () => {
    const { dialog, user, lesson, db } = await circled()
    const replace = within(dialog).getByRole('checkbox', {
      name: 'Replace what’s underneath (Photo: leaf in sunlight)'
    })
    expect(replace).toBeChecked()
    // while it is ticked the photo is hidden so the preview stands in for it
    expect(
      screen.queryByRole('button', { name: 'Fill picture spot: Photo: leaf in sunlight' })
    ).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Place it' }))
    await waitFor(() => expect(db.placeAsset).toHaveBeenCalledTimes(1))
    const args = db.placeAsset.mock.calls[0]![0]
    expect(args).toMatchObject({
      slideId: 's3',
      source: { kind: 'library', assetId: 'ast_leaf_cross_section' },
      fit: 'fit',
      target: { kind: 'region', replaceElementId: 's3-photo', bbox: region.bbox }
    })
    const filled = lesson.deck.slides[2]!.elements.find((e) => e.id === 's3-photo') as ImageElement
    expect(filled.assetId).toBe('ast_leaf_cross_section')
    expect(filled.placeholder).toBeDefined()
    expect(lesson.past).toHaveLength(1)
    // the region and its chip go, the sheet closes, the new picture is on the stage
    await waitFor(() => expect(seen.chat?.regions).toHaveLength(0))
    expect(screen.queryByRole('dialog', { name: 'Add to region 1' })).not.toBeInTheDocument()
  })

  it('unticked, it adds a new picture on top', async () => {
    const { dialog, user, db } = await circled()
    await user.click(within(dialog).getByRole('checkbox', { name: /^Replace what’s underneath/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Place it' }))
    await waitFor(() => expect(db.placeAsset).toHaveBeenCalled())
    expect(db.placeAsset.mock.calls[0]![0].target.replaceElementId).toBeNull()
  })

  it('Cancel and Esc close the sheet and keep the region', async () => {
    const { dialog, user, db } = await circled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Add to region 1' })).not.toBeInTheDocument()
    expect(seen.chat?.regions).toHaveLength(1)
    act(() => seen.circle!.onAddAsset!('r1'))
    const again = await regionSheet()
    await within(again).findByText('SUGGESTED FOR THIS SLIDE')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Add to region 1' })).not.toBeInTheDocument()
    expect(seen.chat?.regions).toHaveLength(1)
    expect(db.placeAsset).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter places it', async () => {
    const { dialog, user, db } = await circled()
    await within(dialog).findByText('SUGGESTED FOR THIS SLIDE')
    await waitFor(() => expect(document.querySelector('.stage-preview')).not.toBeNull())
    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(db.placeAsset).toHaveBeenCalled())
  })

  it('warns when the picture is small for the circle', async () => {
    const small = { ...LIBRARY[2]!, width: 200, height: 133 }
    await open({ library: [small], assets: { suggest: () => ok({ assets: [small] }) } })
    act(() => seen.circle!.onAddRegion(region))
    act(() => seen.circle!.onAddAsset!('r1'))
    const dialog = await regionSheet()
    expect(
      await within(dialog).findByText('This picture is small, so it may look blurry at this size.')
    ).toBeInTheDocument()
  })

  it('says so when the library is empty', async () => {
    const view = await open({ library: [], assets: { suggest: () => ok({ assets: [] }) } })
    act(() => seen.circle!.onAddRegion(region))
    act(() => seen.circle!.onAddAsset!('r1'))
    const dialog = await regionSheet()
    expect(await within(dialog).findByText("You don't have any assets yet.")).toBeInTheDocument()
    await view.user.click(within(dialog).getByRole('button', { name: 'Find online' }))
    expect(view.shell.navigate).toHaveBeenCalledWith('assets', { kind: 'online' })
    expect(within(dialog).getByRole('button', { name: 'Place it' })).toBeDisabled()
  })

  it('shows the error and stays open when placing fails', async () => {
    const view = await open({
      deckBuilder: {
        placeAsset: () =>
          fail('io', 'Couldn’t save that. Check there’s space on this PC and try again.')
      }
    })
    act(() => seen.circle!.onAddRegion(region))
    act(() => seen.circle!.onAddAsset!('r1'))
    const dialog = await regionSheet()
    await within(dialog).findByText('SUGGESTED FOR THIS SLIDE')
    await waitFor(() => expect(document.querySelector('.stage-preview')).not.toBeNull())
    await view.user.click(within(dialog).getByRole('button', { name: 'Place it' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Couldn’t save that.')
    expect(seen.chat?.regions).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Add to region 1' })).toBeInTheDocument()
  })
})

describe('A12: exporting with empty picture spots', () => {
  it('asks first, and "Export anyway" exports again leaving them out', async () => {
    const exportPptx = vi
      .fn()
      .mockReturnValueOnce({ status: 'spots', count: 1, slides: [3] })
      .mockReturnValueOnce({
        status: 'saved',
        path: 'C:\\x.pptx',
        fileName: 'x.pptx',
        missingFonts: []
      })
    const view = await open({ deckBuilder: { exportPptx } })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    const dialog = await screen.findByRole('dialog', { name: '1 picture spot is still empty' })
    expect(
      within(dialog).getByText(
        'They won’t appear in the PowerPoint. Fill them first, or export without them.'
      )
    ).toBeInTheDocument()
    expect(exportPptx).toHaveBeenCalledWith({ lessonId: 'les_1' })
    await view.user.click(within(dialog).getByRole('button', { name: 'Export anyway' }))
    await waitFor(() => expect(exportPptx).toHaveBeenCalledTimes(2))
    expect(exportPptx).toHaveBeenLastCalledWith({ lessonId: 'les_1', ignoreSpots: true })
    expect(await screen.findByText('Saved x.pptx')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /picture spot/ })).not.toBeInTheDocument()
  })

  it('"Fill them first" opens the first spot and exports nothing', async () => {
    const exportPptx = vi.fn().mockReturnValue({ status: 'spots', count: 3, slides: [1, 2, 3] })
    const view = await open({ deck: threeSpots(), deckBuilder: { exportPptx } })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    const dialog = await screen.findByRole('dialog', { name: '3 picture spots are still empty' })
    await view.user.click(within(dialog).getByRole('button', { name: 'Fill them first' }))
    expect(await sheet()).toBeInTheDocument()
    expect(exportPptx).toHaveBeenCalledTimes(1)
  })

  it('Esc leaves the question without exporting', async () => {
    const exportPptx = vi.fn().mockReturnValue({ status: 'spots', count: 1, slides: [3] })
    const view = await open({ deckBuilder: { exportPptx } })
    await view.user.click(screen.getByRole('button', { name: 'Export to PowerPoint' }))
    await screen.findByRole('dialog', { name: '1 picture spot is still empty' })
    await view.user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /picture spot/ })).not.toBeInTheDocument()
    )
    expect(exportPptx).toHaveBeenCalledTimes(1)
  })
})
