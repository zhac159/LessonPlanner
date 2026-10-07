import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ok } from '@shared/result'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { PluginManifestView } from '@shared/contracts/deck-builder-plugins'
import { QUIZ_MANIFEST } from '@ui/plugin/fixtures'
import { LESSON, USAGE, plugin, setupChat } from './testing'

const BOX = { name: 'Message your planning buddy' }
const QUIZ = plugin({ id: 'quiz', name: 'Quiz' })
const SIMPLE_MANIFEST: PluginManifestView = {
  ...QUIZ_MANIFEST,
  id: 'summary',
  name: 'Summary',
  title: 'Lesson summary',
  inputs: []
}
const SIMPLE = plugin({
  id: 'summary',
  name: 'Summary',
  hasInputs: false,
  needsSlides: false,
  scope: 'lesson',
  order: 2
})
const CIRCLE = plugin({ id: 'explain', name: 'Explain', scope: 'region', order: 3 })

const manifests = (extra: Partial<Record<string, PluginManifestView>> = {}) =>
  vi.fn(({ pluginId }: { pluginId: string }) => {
    const manifest = extra[pluginId] ?? (pluginId === 'summary' ? SIMPLE_MANIFEST : QUIZ_MANIFEST)
    return ok({ manifest, lastInputs: null })
  })

type RunArgs = Parameters<DeckBuilderApi['plugins:run']>[0]
const STARTED = (_args: RunArgs) => ok({ jobId: 'job_p', messageId: 'mp' })

function setupPlugins(overrides: Parameters<typeof setupChat>[0] = {}) {
  const getManifest = manifests()
  const run = vi.fn(STARTED)
  const t = setupChat({
    ...overrides,
    deckBuilder: {
      'plugins:list': () => [QUIZ, SIMPLE, CIRCLE],
      'plugins:getManifest': getManifest,
      'plugins:run': run,
      'plugins:cancel': () => undefined,
      ...overrides.deckBuilder
    }
  })
  return { ...t, getManifest, run }
}

const openMenu = async (t: ReturnType<typeof setupPlugins>): Promise<void> => {
  await t.user.click(screen.getByRole('button', { name: 'Plugins' }))
  await screen.findByRole('menu')
}

describe('EditorChat plugin menu', () => {
  it('opens from the + button with the plugins from the contract', async () => {
    const t = setupPlugins()
    await openMenu(t)
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Quiz/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Summary/ })).toBeInTheDocument()
  })

  it('opens when she types / in an empty box, and keeps the box empty', async () => {
    const t = setupPlugins()
    await t.user.type(screen.getByRole('textbox', BOX), '/')
    expect(await screen.findByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('')
  })

  it('does not open for a / in the middle of a sentence', async () => {
    const t = setupPlugins()
    await t.user.type(screen.getByRole('textbox', BOX), 'and/or')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('and/or')
  })

  it('disables a circle plugin until something is circled, with the reason', async () => {
    const t = setupPlugins()
    await openMenu(t)
    const tile = screen.getByRole('menuitem', { name: /Explain/ })
    expect(tile).toHaveAttribute('aria-disabled', 'true')
    await t.user.click(tile)
    expect(t.getManifest).not.toHaveBeenCalled()
  })

  it('enables it once a region is circled', async () => {
    const region = {
      id: 'r1',
      n: 1,
      slideId: 's1',
      path: [[0, 0]] as Array<[number, number]>,
      bbox: { x: 0, y: 0, w: 10, h: 10 },
      targetElementIds: []
    }
    const t = setupPlugins({ props: { regions: [region] } })
    await openMenu(t)
    expect(screen.getByRole('menuitem', { name: /Explain/ })).not.toHaveAttribute('aria-disabled')
  })

  it('disables every tile while a job runs', async () => {
    const t = setupPlugins({ props: { runningJob: { jobId: 'j', kind: 'chat', messageId: 'm' } } })
    await openMenu(t)
    expect(screen.getByRole('menuitem', { name: /Quiz/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('"Manage" says more plugins are coming', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: 'Manage' }))
    expect(await screen.findByText('More plugins are coming soon.')).toBeInTheDocument()
  })
})

describe('EditorChat plugin sheet', () => {
  it('opens the options sheet for a plugin with inputs and hides the conversation', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    expect(await screen.findByRole('dialog', { name: 'Quiz from slides' })).toBeInTheDocument()
    expect(t.getManifest).toHaveBeenCalledWith({ pluginId: 'quiz' })
  })

  it('runs with the form values and the editor context, then shows the request and progress', async () => {
    const t = setupPlugins({ props: { selectedSlideIds: ['s2'], currentSlideId: 's2' } })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    expect(t.run).toHaveBeenCalledTimes(1)
    const args = t.run.mock.calls[0][0]
    expect(args).toMatchObject({ pluginId: 'quiz', lessonId: LESSON })
    expect(args.inputs).toMatchObject({ count: 10, difficulty: 'mixed' })
    expect(args.context).toMatchObject({ currentSlideId: 's2', selectedSlideIds: ['s2'] })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Quiz from slides' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plugins' })).toBeInTheDocument()
  })

  it('stops the plugin job from the progress card', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    await t.user.click(screen.getAllByRole('button', { name: 'Stop' })[0])
    expect(t.db['plugins:cancel']).toHaveBeenCalledWith({ jobId: 'job_p' })
  })

  it('shows the file a plugin made as a card with Open and Show in folder', async () => {
    const openExport = vi.fn(() => ok())
    const showExport = vi.fn(() => ok())
    const t = setupPlugins({ deckBuilder: { openExport, showExport } })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    t.emit('plugins:file', {
      lessonId: LESSON,
      messageId: 'mp',
      file: { name: 'Quiz.docx', path: 'C:/Quizzes/Quiz.docx', kind: 'docx' }
    })
    t.emit('chat:done', { lessonId: LESSON, messageId: 'mp', usage: USAGE })
    const card = await screen.findByRole('group', { name: 'Quiz.docx' })
    await t.user.click(within(card).getByRole('button', { name: 'Open' }))
    expect(openExport).toHaveBeenCalledWith({ path: 'C:/Quizzes/Quiz.docx' })
    await t.user.click(within(card).getByRole('button', { name: 'Show in folder' }))
    expect(showExport).toHaveBeenCalledWith({ path: 'C:/Quizzes/Quiz.docx' })
  })

  it('goes back to the chat with the arrow and keeps the values for next time', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'More questions' }))
    await t.user.click(screen.getByRole('button', { name: 'Back to chat' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plugins' })).toHaveFocus()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    expect(await screen.findByRole('spinbutton', { name: 'How many questions?' })).toHaveValue(11)
  })

  it('forgets the edits on Cancel', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'More questions' }))
    await t.user.click(screen.getByRole('button', { name: 'Cancel' }))
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    expect(await screen.findByRole('spinbutton', { name: 'How many questions?' })).toHaveValue(10)
  })

  it('starts a plugin without options straight away', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Summary/ }))
    expect(await screen.findByRole('group', { name: 'Lesson summary' })).toBeInTheDocument()
    expect(t.run).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses the options she used last time', async () => {
    const getManifest = vi.fn(() => ok({ manifest: QUIZ_MANIFEST, lastInputs: { count: 15 } }))
    const t = setupPlugins({ deckBuilder: { 'plugins:getManifest': getManifest } })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    expect(await screen.findByRole('spinbutton', { name: 'How many questions?' })).toHaveValue(15)
  })

  it('tells her when the plugin cannot be opened', async () => {
    const t = setupPlugins({
      deckBuilder: {
        'plugins:getManifest': () => ({ ok: false, code: 'not-found', message: 'No such plugin.' })
      }
    })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    expect(await screen.findByText('No such plugin.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('removes the request again and explains when main refuses the run', async () => {
    const t = setupPlugins({
      deckBuilder: {
        'plugins:run': () => ({
          ok: false,
          code: 'invalid-input',
          message: 'Pick at least one type.'
        })
      }
    })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    expect(await screen.findByText('Pick at least one type.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Quiz from slides' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Quiz from slides' })).toBeInTheDocument()
  })

  it('shows the Connect Claude callout in the sheet when there is no key', async () => {
    const onConnectClaude = vi.fn()
    const t = setupPlugins({
      user: { name: 'Ms Rao', claudeConnected: false },
      props: { onConnectClaude }
    })
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    await t.user.click(await screen.findByRole('button', { name: 'Connect Claude' }))
    expect(onConnectClaude).toHaveBeenCalled()
  })

  it('"Try again" after a failed plugin run starts it with the same options', async () => {
    const t = setupPlugins()
    await openMenu(t)
    await t.user.click(screen.getByRole('menuitem', { name: /Quiz/ }))
    await t.user.click(await screen.findByRole('button', { name: 'Make quiz' }))
    t.emit('ai:error', {
      scope: 'plugin',
      code: 'network',
      message: 'Can’t reach Claude. Check your internet connection.',
      retryable: true
    })
    await t.user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(t.run).toHaveBeenCalledTimes(2)
    expect(t.run.mock.calls[1][0].inputs).toEqual(t.run.mock.calls[0][0].inputs)
  })
})
