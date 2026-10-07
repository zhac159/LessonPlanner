import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { ok } from '@shared/result'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import { HISTORY, LESSON, USAGE, chatItem, setupChat } from './testing'

const BOX = { name: 'Message your planning buddy' }
const STARTED = { 'chat:send': () => ok({ jobId: 'job_1', messageId: 'm2' }) }

const asked = chatItem({
  id: 'u1',
  role: 'user',
  text: 'Can you build tomorrow’s lesson from these?',
  attachments: [{ id: 'a1', name: 'Y8 Photosynthesis LOs.docx', kind: 'docx', sizeBytes: 48_000 }],
  regions: [
    {
      n: 1,
      slideId: 's2',
      slideNumber: 2,
      path: [
        [0, 0],
        [10, 0],
        [10, 10]
      ],
      caption: 'Swap this photo…'
    }
  ]
})
const answered = chatItem({
  id: 'm1',
  role: 'assistant',
  text: 'Done! 8 slides in your Science style.',
  result: { changeSetId: 'cs1', label: '8 slides added', slideIds: ['s1'], undone: false }
})

async function sendText(t: ReturnType<typeof setupChat>, text: string): Promise<void> {
  await t.user.type(screen.getByRole('textbox', BOX), `${text}{Enter}`)
}

describe('EditorChat transcript', () => {
  it('shows the stored messages with their attachment, region chip and result chip', () => {
    setupChat({ props: { initialChat: [asked, answered] } })
    expect(screen.getByText('Can you build tomorrow’s lesson from these?')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Y8 Photosynthesis LOs.docx' })).toBeInTheDocument()
    expect(screen.getByText('Slide 2 · circled')).toBeInTheDocument()
    expect(screen.getByText('Done! 8 slides in your Science style.')).toBeInTheDocument()
    expect(screen.getByText('8 slides added')).toBeInTheDocument()
  })

  it('titles the panel and names the lesson’s style', async () => {
    setupChat({ styles: [{ id: 'sty_science_ks3', name: 'Science KS3' }] })
    expect(screen.getByRole('complementary', { name: 'Your planning buddy' })).toBeInTheDocument()
    expect(await screen.findByText('Knows your Science KS3 style')).toBeInTheDocument()
  })

  it('says it is ready to plan when the lesson has the plain style', () => {
    setupChat({ props: { deck: { ...fixtureDeck(), styleId: null } } })
    expect(screen.getByText('Ready to plan with you')).toBeInTheDocument()
  })

  it('marks a sent region chip as removed when its slide is gone', () => {
    const gone = chatItem({
      ...asked,
      id: 'u2',
      regions: [{ ...asked.regions![0], slideId: 'deleted' }]
    })
    setupChat({ props: { initialChat: [gone] } })
    expect(screen.getByText('Slide 2 · removed')).toBeInTheDocument()
  })
})

describe('EditorChat sending', () => {
  it('sends the draft on Enter, clears the box and shows her message with a progress card', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, '  Add a plenary  ')
    expect(t.db['chat:send']).toHaveBeenCalledWith({
      lessonId: LESSON,
      text: 'Add a plenary',
      attachmentIds: [],
      regions: [],
      markup: [],
      selectedSlideId: 's1',
      assetRefs: []
    })
    expect(screen.getByRole('textbox', BOX)).toHaveValue('')
    expect(screen.getByText('Add a plenary')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Working on it…')
  })

  it('does not send on Shift+Enter: it adds a line', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    await t.user.type(screen.getByRole('textbox', BOX), 'a{Shift>}{Enter}{/Shift}b')
    expect(t.db['chat:send']).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('a\nb')
  })

  it('sends with the Send button and keeps Send disabled for an empty box', async () => {
    const t = setupChat({ deckBuilder: STARTED })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await t.user.type(screen.getByRole('textbox', BOX), 'Hello')
    await t.user.click(screen.getByRole('button', { name: 'Send' }))
    expect(t.db['chat:send']).toHaveBeenCalledTimes(1)
  })

  it('sends the selected slide when the filmstrip has one', async () => {
    const t = setupChat({ deckBuilder: STARTED, props: { currentSlideId: 's3' } })
    await sendText(t, 'Hi')
    expect(t.db['chat:send'].mock.calls[0][0].selectedSlideId).toBe('s3')
  })

  it('puts the draft back and explains when main refuses the message', async () => {
    const t = setupChat({
      deckBuilder: {
        'chat:send': () => ({
          ok: false,
          code: 'invalid-input',
          message: 'Wait for the current change.'
        })
      }
    })
    await sendText(t, 'Make it blue')
    expect(await screen.findByText('Wait for the current change.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Make it blue')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the Connect Claude prompt and sends nothing when there is no key', async () => {
    const t = setupChat({ user: { name: 'Ms Rao', claudeConnected: false } })
    await sendText(t, 'Make it blue')
    expect(t.db['chat:send']).not.toHaveBeenCalled()
    expect(screen.getByText('Connect Claude to use this.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Make it blue')
    await t.user.click(screen.getByRole('button', { name: 'Connect Claude' }))
    expect(t.props.onConnectClaude).toHaveBeenCalledTimes(1)
  })

  it('shows the prompt once however often she tries', async () => {
    const t = setupChat({ user: { name: 'Ms Rao', claudeConnected: false } })
    await sendText(t, 'a')
    await t.user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getAllByText('Connect Claude to use this.')).toHaveLength(1)
  })

  it('shows an Offline pill while the computer is offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      setupChat()
      expect(screen.getByText('Offline')).toBeInTheDocument()
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    }
  })

  it('has no Offline pill when online', () => {
    setupChat()
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
  })
})

describe('EditorChat streaming a reply', () => {
  const reply: ChatItem = { ...answered, id: 'm2', text: 'Added a plenary.' }

  async function startedTurn() {
    const t = setupChat({ deckBuilder: STARTED })
    await sendText(t, 'Add a plenary')
    return t
  }

  it('shows each step, then the text as it arrives, then the stored reply', async () => {
    const t = await startedTurn()
    t.emit('chat:status', {
      lessonId: LESSON,
      messageId: 'm2',
      step: 'Reading the circled area',
      state: 'running'
    })
    expect(screen.getByRole('status')).toHaveTextContent('Reading the circled area')
    t.emit('chat:status', {
      lessonId: LESSON,
      messageId: 'm2',
      step: 'Reading the circled area',
      state: 'done'
    })
    t.emit('chat:status', {
      lessonId: LESSON,
      messageId: 'm2',
      step: 'Drawing your leaf diagram…',
      state: 'running'
    })
    const progress = screen.getByRole('status')
    expect(progress).toHaveTextContent('Drawing your leaf diagram…')
    expect(within(progress).getByText(/Reading the circled area/)).toBeInTheDocument()

    t.emit('chat:delta', { lessonId: LESSON, messageId: 'm2', text: 'Added a ' })
    t.emit('chat:delta', { lessonId: LESSON, messageId: 'm2', text: 'plenary.' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Added a plenary.')).toBeInTheDocument()

    t.view.chat = [chatItem({ id: 'u2', role: 'user', text: 'Add a plenary' }), reply]
    t.emit('chat:done', { lessonId: LESSON, messageId: 'm2', usage: USAGE })
    expect(await screen.findByText('8 slides added')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    expect(screen.getAllByText('Added a plenary.')).toHaveLength(1)
  })

  it('applies each committed change to the deck and tells the editor', async () => {
    const t = await startedTurn()
    const slide = { id: 's9', kind: 'content' as const, elements: [] }
    const changeSet = {
      id: 'cs9',
      by: 'ai' as const,
      summary: 'Added a plenary',
      ops: [{ op: 'insertSlides' as const, afterSlideId: 's3', slides: [slide] }],
      at: '2026-10-06T10:00:00.000Z'
    }
    t.emit('chat:changes', { lessonId: LESSON, changeSet })
    expect(t.props.onLessonChanged).toHaveBeenCalledTimes(1)
    const change = vi.mocked(t.props.onLessonChanged).mock.calls[0][0]
    expect(change.deck.slides.map((s: { id: string }) => s.id)).toEqual(['s1', 's2', 's3', 's9'])
    expect(change.history).toMatchObject({
      canUndo: true,
      undoChangeSetId: 'cs9',
      redoChangeSetId: null
    })
  })

  it('re-reads the lesson when the turn ends and hands the editor the stored deck', async () => {
    const t = await startedTurn()
    t.emit('chat:changes', {
      lessonId: LESSON,
      changeSet: {
        id: 'cs9',
        by: 'ai',
        summary: 'x',
        ops: [{ op: 'setMeta', title: 'New' }],
        at: '2026-10-06T10:00:00.000Z'
      }
    })
    t.view.history = { ...HISTORY, canUndo: true, undoChangeSetId: 'cs9' }
    t.emit('chat:done', { lessonId: LESSON, messageId: 'm2', usage: USAGE })
    await screen.findByRole('button', { name: 'Send' })
    const last = vi.mocked(t.props.onLessonChanged).mock.calls.at(-1)?.[0]
    expect(last?.history.undoChangeSetId).toBe('cs9')
  })

  it('does not tell the editor about a turn that changed nothing', async () => {
    const t = await startedTurn()
    t.view.chat = [reply]
    t.emit('chat:done', { lessonId: LESSON, messageId: 'm2', usage: USAGE })
    await screen.findByText('Added a plenary.')
    expect(t.props.onLessonChanged).not.toHaveBeenCalled()
  })

  it('ignores events from another lesson', async () => {
    const t = await startedTurn()
    t.emit('chat:delta', { lessonId: 'other', messageId: 'm2', text: 'Not mine' })
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument()
  })

  it('keeps the reply on screen if re-reading the lesson fails', async () => {
    const t = setupChat({
      deckBuilder: { ...STARTED, openLesson: () => ({ ok: false, code: 'io', message: 'no' }) }
    })
    await sendText(t, 'Hi')
    t.emit('chat:delta', { lessonId: LESSON, messageId: 'm2', text: 'Hello there.' })
    t.emit('chat:done', { lessonId: LESSON, messageId: 'm2', usage: USAGE })
    expect(await screen.findByText('Hello there.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })
})
