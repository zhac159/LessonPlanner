import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MakeProgress } from '@shared/contracts/assets'
import { fail, ok } from '@shared/result'
import { renderAssets, type RenderAssetsOptions } from '../testRender'
import { PIC, SAMPLE, makePage, makeSummary } from '../testSupport'

const MANY = [
  ...SAMPLE,
  makeSummary('leaf_icon'),
  makeSummary('owl_icon'),
  makeSummary('plant_icon')
]

const tick = (user: ReturnType<typeof renderAssets>['user'], ...titles: string[]) =>
  titles.reduce(
    (chain, title) =>
      chain.then(() => user.click(screen.getByRole('checkbox', { name: `Select ${title}` }))),
    Promise.resolve()
  )

async function openMaker(options: RenderAssetsOptions = {}, ...titles: string[]) {
  const rendered = renderAssets({
    ...options,
    assets: { list: () => makePage(MANY), ...options.assets }
  })
  await screen.findByRole('button', { name: /School logo/ })
  await rendered.user.click(screen.getByRole('button', { name: 'Select' }))
  await tick(
    rendered.user,
    ...(titles.length ? titles : ['Beaker', 'Microscope', '5-minute timer'])
  )
  return rendered
}

const progress = (over: Partial<MakeProgress> = {}): MakeProgress => ({
  jobId: 'job1',
  stage: 'drawing',
  versions: [1, 2, 3, 4].map((index) => ({
    index,
    state: 'waiting' as const,
    thumbDataUrl: null
  })),
  ...over
})
const ready = (...indices: number[]) =>
  [1, 2, 3, 4].map((index) => ({
    index,
    state: indices.includes(index) ? ('ready' as const) : ('waiting' as const),
    thumbDataUrl: indices.includes(index) ? PIC : null
  }))

const pictureMaker = {
  'make:mode': () => ({
    mode: 'picture-maker' as const,
    modelLabel: 'Nano Banana Pro',
    perPictureUsd: 0.135
  })
}

describe('Select and the make panel (A8)', () => {
  it('switches to selection mode: checkboxes, the dark bar, then the panel with Based on', async () => {
    const { user } = renderAssets({ assets: { list: () => makePage(MANY) } })
    await screen.findByRole('button', { name: /School logo/ })
    await user.click(screen.getByRole('button', { name: 'Select' }))
    expect(screen.getByRole('button', { name: 'Done selecting' })).toBeInTheDocument()
    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Make a new one like these' })
    ).not.toBeInTheDocument()
    await tick(user, 'Beaker', 'Microscope', '5-minute timer')
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.getByText('Pick a few that show the look you want')).toBeInTheDocument()
    const panel = screen.getByRole('region', { name: 'Make a new one like these' })
    const basedOn = within(panel).getByRole('region', { name: 'Based on' })
    expect(within(basedOn).getAllByRole('listitem')).toHaveLength(3)
    expect(within(panel).getByRole('button', { name: 'Make 4' })).toBeInTheDocument()
  })

  it('unticks with the × on a thumbnail and Clear, and leaves with Done selecting', async () => {
    const { user } = await openMaker()
    await user.click(screen.getByRole('button', { name: 'Remove beaker_icon' }))
    expect(screen.getByText('2 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByText('0 selected')).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Make a new one like these' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done selecting' }))
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument()
  })

  it('allows six pictures and tells her the seventh is too many', async () => {
    const { user } = await openMaker(
      {},
      'Beaker',
      'Microscope',
      '5-minute timer',
      'Leaf icon',
      'Owl icon',
      'Plant icon'
    )
    expect(screen.getByText('6 selected')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select School logo' }))
    expect(await screen.findByText('Pick up to 6 so the look stays clear.')).toBeInTheDocument()
    expect(screen.getByText('6 selected')).toBeInTheDocument()
  })

  it('starts selecting with the pictures from a make intent', async () => {
    renderAssets({
      assets: { list: () => makePage(MANY) },
      shell: { intent: { kind: 'make', basedOn: ['id-beaker_icon', 'id-timer_icon'] } }
    })
    expect(await screen.findByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Make a new one like these' })).toBeInTheDocument()
  })
})

describe('what can be made', () => {
  it('without a picture maker says Claude will draw it, and links to Settings', async () => {
    const { user, shell } = await openMaker()
    expect(
      await screen.findByText(/No picture maker connected, so Claude will draw this/)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Google bills this/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add a picture maker' }))
    expect(shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })

  it('warns that a photo needs the picture maker', async () => {
    const { user } = await openMaker()
    await user.type(
      await screen.findByLabelText('What should it be?'),
      'A realistic photo of a volcano'
    )
    expect(screen.getByText(/Photo-like pictures need the picture maker/)).toBeInTheDocument()
  })

  it('with a picture maker shows the cost and the watermark note', async () => {
    const { user } = await openMaker({ assets: pictureMaker })
    expect(await screen.findByText('About 54 cents · Google bills this')).toBeInTheDocument()
    expect(
      screen.getByText('Pictures made with Nano Banana Pro carry an invisible Google watermark.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '2' }))
    expect(screen.getByText('About 27 cents · Google bills this')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make 2' })).toBeInTheDocument()
  })

  it('without Claude explains why and never starts a job', async () => {
    const start = vi.fn()
    const { user } = await openMaker({
      assets: {
        'make:mode': () => ({
          mode: 'unavailable' as const,
          modelLabel: null,
          perPictureUsd: null
        }),
        'make:start': start
      }
    })
    expect(
      (await screen.findAllByText(/Making pictures needs your Claude key/)).length
    ).toBeGreaterThan(0)
    await user.type(screen.getByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    expect(start).not.toHaveBeenCalled()
  })

  it('does not start without words', async () => {
    const start = vi.fn()
    const { user } = await openMaker({ assets: { 'make:start': start } })
    await user.click(await screen.findByRole('button', { name: 'Make 4' }))
    expect(start).not.toHaveBeenCalled()
  })
})

describe('making and keeping', () => {
  const start = () => vi.fn(() => ok({ jobId: 'job1' }))

  it('makes four versions, shows them as they finish, and keeps the one she picks', async () => {
    const make = start()
    const keep = vi.fn(() => ok({ asset: makeSummary('bunsen_burner_icon') }))
    const { user, clients } = await openMaker({
      assets: { ...pictureMaker, 'make:start': make, 'make:keep': keep }
    })
    await user.type(
      await screen.findByLabelText('What should it be?'),
      'A Bunsen burner with a lit flame'
    )
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    expect(make).toHaveBeenCalledWith({
      basedOn: ['id-beaker_icon', 'id-microscope_icon', 'id-timer_icon'],
      prompt: 'A Bunsen burner with a lit flame',
      versions: 4,
      kind: 'icon'
    })
    expect(await screen.findByText('Pick the one you like')).toBeInTheDocument()
    expect(screen.getAllByText('Looking at your pictures…')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Keep a version' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )

    act(() => clients.emit('assets', 'make:progress', progress({ stage: 'describing' })))
    act(() => clients.emit('assets', 'make:progress', progress({ versions: ready(1, 3) })))
    expect(await screen.findByRole('radio', { name: 'Version 3' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Version 2, still making' })).toBeInTheDocument()
    expect(screen.getAllByText('Drawing…')).toHaveLength(2)

    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({ stage: 'done', versions: ready(1, 2, 3, 4) })
      )
    )
    await user.click(await screen.findByRole('radio', { name: 'Version 3' }))
    expect(screen.getByText('Version 3 selected')).toBeInTheDocument()
    expect(screen.getByLabelText('Name in chat')).toHaveValue('bunsen_burner_icon')
    await user.click(screen.getByRole('button', { name: 'Keep version 3' }))
    expect(keep).toHaveBeenCalledWith({
      jobId: 'job1',
      version: 3,
      name: 'bunsen_burner_icon',
      kind: 'icon'
    })
    expect(await screen.findByText('bunsen_burner_icon added to Your assets')).toBeInTheDocument()
    expect(screen.getByLabelText('What should it be?')).toHaveValue('')
    expect(screen.queryByText('Pick the one you like')).not.toBeInTheDocument()
  })

  it('uses a progress event that arrives before the job id does', async () => {
    let release: (v: ReturnType<typeof ok<{ jobId: string }>>) => void = () => {}
    const gate = new Promise<ReturnType<typeof ok<{ jobId: string }>>>((r) => (release = r))
    const { user, clients } = await openMaker({
      assets: { ...pictureMaker, 'make:start': () => gate }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({ stage: 'done', versions: ready(1, 2, 3, 4) })
      )
    )
    await act(async () => release(ok({ jobId: 'job1' })))
    expect(await screen.findByRole('radio', { name: 'Version 4' })).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('keeps the name field in step with a name that is already taken', async () => {
    const keep = vi.fn()
    const { user, clients } = await openMaker({
      assets: {
        ...pictureMaker,
        'make:start': start(),
        'make:keep': keep,
        checkName: ({ name }) =>
          name === 'flame_icon'
            ? {
                ok: false as const,
                problem: 'taken' as const,
                message: 'You already have an asset called flame_icon.'
              }
            : { ok: true as const, name }
      }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({ stage: 'done', versions: ready(1, 2, 3, 4) })
      )
    )
    await user.click(await screen.findByRole('radio', { name: 'Version 1' }))
    expect(
      await screen.findByText('You already have an asset called flame_icon.')
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep version 1' }))
    expect(keep).not.toHaveBeenCalled()
    const field = screen.getByLabelText('Name in chat')
    await user.clear(field)
    await user.type(field, 'torch_icon')
    await waitFor(() => expect(screen.queryByText(/already have an asset/)).not.toBeInTheDocument())
  })

  it('shows the failure, marks the tiles and Try again starts a new job with the same inputs', async () => {
    const make = vi.fn(() => ok({ jobId: 'job1' }))
    const { user, clients } = await openMaker({ assets: { ...pictureMaker, 'make:start': make } })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    await screen.findByText('Pick the one you like')
    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({
          stage: 'error',
          error: { code: 'picture-maker', message: 'The picture maker said no.', retryable: true }
        })
      )
    )
    expect(await screen.findByText('The picture maker said no.')).toBeInTheDocument()
    expect(screen.getAllByText("Didn't work")).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(make).toHaveBeenCalledTimes(2)
    expect(make).toHaveBeenLastCalledWith(
      expect.objectContaining({ prompt: 'A flame', versions: 4 })
    )
  })

  it('Try this one again draws only that version again', async () => {
    const retry = vi.fn(() => ok())
    const { user, clients } = await openMaker({
      assets: { ...pictureMaker, 'make:start': start(), 'make:retry': retry }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    await screen.findByText('Pick the one you like')
    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({
          stage: 'done',
          versions: [
            { index: 1, state: 'ready', thumbDataUrl: PIC },
            { index: 2, state: 'failed', thumbDataUrl: null },
            { index: 3, state: 'ready', thumbDataUrl: PIC },
            { index: 4, state: 'ready', thumbDataUrl: PIC }
          ]
        })
      )
    )
    await user.click(await screen.findByRole('button', { name: /Try this one again/ }))
    expect(retry).toHaveBeenCalledWith({ jobId: 'job1', version: 2 })
    // the job itself was not started again
    expect(screen.getAllByRole('button', { name: /Try this one again/ })).toHaveLength(1)
  })

  it('tells her in words when that version fails again', async () => {
    const retry = vi.fn(() => fail('network', 'Could not reach Google.'))
    const { user, clients } = await openMaker({
      assets: { ...pictureMaker, 'make:start': start(), 'make:retry': retry }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    await screen.findByText('Pick the one you like')
    act(() =>
      clients.emit(
        'assets',
        'make:progress',
        progress({
          stage: 'done',
          versions: [
            { index: 1, state: 'ready', thumbDataUrl: PIC },
            { index: 2, state: 'failed', thumbDataUrl: null },
            { index: 3, state: 'ready', thumbDataUrl: PIC },
            { index: 4, state: 'ready', thumbDataUrl: PIC }
          ]
        })
      )
    )
    await user.click(await screen.findByRole('button', { name: /Try this one again/ }))
    expect(await screen.findByText('Could not reach Google.')).toBeInTheDocument()
  })

  it('stops a running job when she leaves selection mode', async () => {
    const cancel = vi.fn()
    const { user } = await openMaker({
      assets: { ...pictureMaker, 'make:start': start(), 'make:cancel': cancel }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    await screen.findByText('Pick the one you like')
    await user.click(screen.getByRole('button', { name: 'Done selecting' }))
    expect(cancel).toHaveBeenCalledWith({ jobId: 'job1' })
    expect(await screen.findByText('Stopped. Nothing was saved.')).toBeInTheDocument()
  })

  it('tells her when the job could not start', async () => {
    const { user } = await openMaker({
      assets: {
        ...pictureMaker,
        'make:start': () => ({
          ok: false as const,
          code: 'not-connected' as never,
          message: 'Add your Google key first.'
        })
      }
    })
    await user.type(await screen.findByLabelText('What should it be?'), 'A flame')
    await user.click(screen.getByRole('button', { name: 'Make 4' }))
    expect(await screen.findByText('Add your Google key first.')).toBeInTheDocument()
    expect(screen.queryByText('Pick the one you like')).not.toBeInTheDocument()
  })
})
