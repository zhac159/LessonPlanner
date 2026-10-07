import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ok } from '@shared/result'
import type { AiErrorCode } from '@shared/result'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import { LESSON, USAGE, chatItem, setupChat } from './testing'

const BOX = { name: 'Message your planning buddy' }
const STARTED = { 'chat:send': () => ok({ jobId: 'job_1', messageId: 'm2' }) }

async function sendText(t: ReturnType<typeof setupChat>, text: string): Promise<void> {
  await t.user.type(screen.getByRole('textbox', BOX), `${text}{Enter}`)
}

afterEach(() => vi.restoreAllMocks())

describe('EditorChat stopping a turn', () => {
  it('stops from the progress card and says nothing was changed', async () => {
    const t = setupChat({ deckBuilder: { ...STARTED, 'chat:cancel': () => undefined } })
    await sendText(t, 'Add a plenary')
    await t.user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Stop' }))
    expect(t.db['chat:cancel']).toHaveBeenCalledWith({ jobId: 'job_1' })
    expect(screen.getByRole('status')).toHaveTextContent('Stopping…')

    t.view.chat = [
      chatItem({
        id: 'm2',
        role: 'assistant',
        error: { code: 'cancelled', message: 'Stopped. Nothing was changed.' }
      })
    ]
    t.emit('chat:done', { lessonId: LESSON, messageId: 'm2', usage: USAGE })
    expect(await screen.findByText('Stopped. Nothing was changed.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('turns the Send button into Stop while a turn runs, and Stop cancels it too', async () => {
    const t = setupChat({ deckBuilder: { ...STARTED, 'chat:cancel': () => undefined } })
    await sendText(t, 'Add a plenary')
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
    const stops = screen.getAllByRole('button', { name: 'Stop' })
    expect(stops).toHaveLength(2)
    await t.user.click(stops[1])
    expect(t.db['chat:cancel']).toHaveBeenCalledTimes(1)
  })

  it('lets her keep typing while a turn runs but does not send it', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'First')
    await t.user.type(screen.getByRole('textbox', BOX), 'Second{Enter}')
    expect(t.db['chat:send']).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Second')
  })

  it('shows the working status in the panel header', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
    await sendText(t, 'Hi')
    expect(screen.getByText('Working')).toBeInTheDocument()
  })
})

describe('EditorChat errors', () => {
  const CASES: Array<[AiErrorCode, string, string | null, boolean]> = [
    ['no-key', 'Claude isn’t connected. Add your API key to keep going.', 'Open Settings', false],
    [
      'invalid-key',
      'Claude isn’t connected. Add your API key to keep going.',
      'Open Settings',
      false
    ],
    ['no-credit', 'Your Claude account is out of credit.', 'Open platform.claude.com ↗', false],
    ['rate-limited', 'Claude is busy right now. Try again in a minute.', 'Try again', true],
    ['overloaded', 'Claude is busy right now. Try again in a minute.', 'Try again', true],
    ['network', 'Can’t reach Claude. Check your internet connection.', 'Try again', true],
    ['refused', 'Claude couldn’t help with that request.', null, false],
    [
      'permission',
      'Your API key can’t use Sonnet 5.5. Pick another model in Settings.',
      'Open Settings',
      false
    ],
    [
      'model-unavailable',
      'Your API key can’t use Sonnet 5.5. Pick another model in Settings.',
      'Open Settings',
      false
    ],
    ['too-large', 'That file is too big to send to Claude.', null, false],
    ['unknown', 'Something went wrong talking to Claude.', 'Try again', true]
  ]

  it.each(CASES)(
    '%s shows its message with the right single action',
    async (code, message, action, retryable) => {
      const t = setupChat({ deckBuilder: STARTED })
      await sendText(t, 'Hi')
      t.emit('ai:error', { scope: 'chat', code, message, retryable })
      expect(await screen.findByText(message)).toBeInTheDocument()
      const buttons = [
        'Try again',
        'Open Settings',
        'Open platform.claude.com ↗',
        'Finish the rest'
      ]
      const shown = buttons.filter((name) => screen.queryByRole('button', { name }))
      expect(shown).toEqual(action ? [action] : [])
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    }
  )

  it('"Try again" sends the same message again', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'Make it blue')
    t.emit('ai:error', {
      scope: 'chat',
      code: 'network',
      message: 'Can’t reach Claude.',
      retryable: true
    })
    await t.user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(t.db['chat:send']).toHaveBeenCalledTimes(2)
    expect(t.db['chat:send'].mock.calls[1][0]).toEqual(t.db['chat:send'].mock.calls[0][0])
  })

  it('"Open Settings" goes to Settings › AI through the editor', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'Hi')
    t.emit('ai:error', {
      scope: 'chat',
      code: 'no-key',
      message: 'Claude isn’t connected.',
      retryable: false
    })
    await t.user.click(await screen.findByRole('button', { name: 'Open Settings' }))
    expect(t.props.onConnectClaude).toHaveBeenCalledTimes(1)
  })

  it('"Open platform.claude.com" opens the console in the browser', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'Hi')
    t.emit('ai:error', {
      scope: 'chat',
      code: 'no-credit',
      message: 'Out of credit.',
      retryable: false
    })
    await t.user.click(await screen.findByRole('button', { name: 'Open platform.claude.com ↗' }))
    expect(open).toHaveBeenCalledWith('https://platform.claude.com/', '_blank', 'noopener')
  })

  it('uses the stored error message once the lesson is re-read', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'Hi')
    t.view.chat = [
      chatItem({
        id: 'm2',
        role: 'assistant',
        error: {
          code: 'invalid-input',
          message: 'I couldn’t make that change cleanly. Nothing was changed.',
          action: 'retry'
        }
      })
    ]
    t.emit('ai:error', { scope: 'chat', code: 'unknown', message: 'x', retryable: true })
    expect(
      await screen.findByText('I couldn’t make that change cleanly. Nothing was changed.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('EditorChat restoring a running job', () => {
  it('shows the live job of a reopened lesson and follows its events', async () => {
    const t = setupChat({
      deckBuilder: { 'chat:cancel': () => undefined },
      props: { runningJob: { jobId: 'job_7', kind: 'chat', messageId: 'm7' } }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Working on it…')
    t.emit('chat:status', { lessonId: LESSON, messageId: 'm7', step: 'Drawing', state: 'running' })
    expect(screen.getByRole('status')).toHaveTextContent('Drawing')
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(2)
    await t.user.click(screen.getAllByRole('button', { name: 'Stop' })[0])
    expect(t.db['chat:cancel']).toHaveBeenCalledWith({ jobId: 'job_7' })
  })

  it('stops a plugin job through the plugins contract', async () => {
    const t = setupChat({
      deckBuilder: { 'plugins:cancel': () => undefined },
      props: { runningJob: { jobId: 'job_8', kind: 'plugin', messageId: 'm8' } }
    })
    await t.user.click(screen.getAllByRole('button', { name: 'Stop' })[0])
    expect(t.db['plugins:cancel']).toHaveBeenCalledWith({ jobId: 'job_8' })
  })

  it('shows slide generation with its progress and stops it through the lessons contract', async () => {
    const t = setupChat({
      deckBuilder: { cancel: () => undefined },
      props: { runningJob: { jobId: 'job_9', kind: 'generation', messageId: 'm9' } }
    })
    expect(screen.getByRole('status')).toHaveTextContent('Making your slides…')
    t.emit('gen-progress', { lessonId: LESSON, stage: 'writing', done: 2, total: 8 })
    expect(screen.getByRole('status')).toHaveTextContent('Writing slide 3 of 8…')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await t.user.click(screen.getAllByRole('button', { name: 'Stop' })[0])
    expect(t.db.cancel).toHaveBeenCalledWith({ jobId: 'job_9' })
  })

  it('re-reads the lesson when generation ends and tells the editor', async () => {
    const t = setupChat({
      props: { runningJob: { jobId: 'job_9', kind: 'generation', messageId: 'm9' } }
    })
    t.view.chat = [chatItem({ id: 'm9', role: 'assistant', text: 'Made 8 slides.' })]
    t.emit('gen-progress', { lessonId: LESSON, stage: 'done', done: 8, total: 8 })
    expect(await screen.findByText('Made 8 slides.')).toBeInTheDocument()
    expect(t.props.onLessonChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('draws the picture-spots card under the generation message when main stored showSpots', async () => {
    const t = setupChat({
      props: {
        spots: { count: 2, onFillFirst: vi.fn() },
        runningJob: { jobId: 'job_9', kind: 'generation', messageId: 'm9' }
      }
    })
    t.emit('chat:delta', { lessonId: LESSON, messageId: 'm9', text: 'Made 8 slides.' })
    t.view.chat = [
      chatItem({ id: 'm9', role: 'assistant', text: 'Made 8 slides.', showSpots: true })
    ]
    t.emit('gen-progress', { lessonId: LESSON, stage: 'done', done: 8, total: 8 })
    expect(await screen.findByText('2 picture spots to fill')).toBeInTheDocument()
    expect(screen.getAllByText('Made 8 slides.')).toHaveLength(1)
  })

  it('offers "Finish the rest" after a generation stopped, and starts it again', async () => {
    const stopped: ChatItem = chatItem({
      id: 'm9',
      role: 'assistant',
      text: 'Stopped after 5 of 8 slides.',
      error: { code: 'cancelled', message: 'Stopped after 5 of 8 slides.', action: 'finish' }
    })
    const t = setupChat({
      deckBuilder: { finishGeneration: () => ok({ jobId: 'job_10', messageId: 'm10' }) },
      props: { initialChat: [stopped] }
    })
    await t.user.click(screen.getByRole('button', { name: 'Finish the rest' }))
    expect(t.db.finishGeneration).toHaveBeenCalledWith({ lessonId: LESSON })
    expect(await screen.findByRole('status')).toHaveTextContent('Making your slides…')
  })
})
