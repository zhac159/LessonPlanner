import { createEvent, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fixtureDeck } from '@shared/deck/testing'
import { ok } from '@shared/result'
import type { AttachmentRef, RegionDraft } from '@shared/contracts/deck-builder-chat'
import { currentSentHighlight, setSentHighlight } from '../circle/sentHighlight'
import { LESSON, chatItem, setupChat } from './testing'

const BOX = { name: 'Message your planning buddy' }
const STARTED = { 'chat:send': () => ok({ jobId: 'job_1', messageId: 'm2' }) }

/** The card of a file that finished attaching (the "Uploading…" card is replaced by it). */
const settled = async (name: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByText('Uploading…')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name })).toBeInTheDocument()
  })
}

const attachment = (n: number): AttachmentRef => ({
  id: `att_${n}`,
  name: `Notes ${n}.pdf`,
  kind: 'pdf',
  sizeBytes: 2048
})

const region = (n: number, slideId = 's2'): RegionDraft => ({
  id: `r${n}`,
  n,
  slideId,
  path: [
    [100, 100],
    [400, 100],
    [400, 400]
  ],
  bbox: { x: 100, y: 100, w: 300, h: 300 },
  targetElementIds: ['e1']
})

afterEach(() => setSentHighlight(null))

describe('EditorChat attachments', () => {
  it('adds a file from the paperclip and sends its id', async () => {
    const t = setupChat({
      deckBuilder: { ...STARTED, 'chat:attach': () => ok({ attachment: attachment(1) }) }
    })
    await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(await screen.findByRole('group', { name: 'Notes 1.pdf' })).toBeInTheDocument()
    await t.user.type(screen.getByRole('textbox', BOX), 'Use this{Enter}')
    expect(t.db['chat:send'].mock.calls[0][0].attachmentIds).toEqual(['att_1'])
    expect(screen.queryByRole('button', { name: 'Remove Notes 1.pdf' })).not.toBeInTheDocument()
  })

  it('does nothing when the file dialog is cancelled', async () => {
    const t = setupChat({ deckBuilder: { 'chat:attach': () => ok({ cancelled: true as const }) } })
    await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(t.db['chat:attach']).toHaveBeenCalledWith({ lessonId: LESSON })
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
  })

  it('removes a staged file with its ×', async () => {
    const t = setupChat({ deckBuilder: { 'chat:attach': () => ok({ attachment: attachment(1) }) } })
    await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await t.user.click(await screen.findByRole('button', { name: 'Remove Notes 1.pdf' }))
    expect(screen.queryByRole('group', { name: 'Notes 1.pdf' })).not.toBeInTheDocument()
  })

  it('sends a file with no text', async () => {
    const t = setupChat({
      deckBuilder: { ...STARTED, 'chat:attach': () => ok({ attachment: attachment(1) }) }
    })
    await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    await screen.findByRole('group', { name: 'Notes 1.pdf' })
    await t.user.click(screen.getByRole('button', { name: 'Send' }))
    expect(t.db['chat:send']).toHaveBeenCalledTimes(1)
  })

  it('says so when the dialog fails', async () => {
    const t = setupChat({
      deckBuilder: {
        'chat:attach': () => ({ ok: false, code: 'io', message: 'Couldn’t read that file.' })
      }
    })
    await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
    expect(await screen.findByText('Couldn’t read that file.')).toBeInTheDocument()
  })

  it('attaches files dropped on the panel through their path', async () => {
    const t = setupChat({
      deckBuilder: {
        'chat:attachPath': ({ path }) =>
          ok({ attachment: { ...attachment(2), name: path.split('/').pop() ?? '' } })
      }
    })
    const panel = screen.getByRole('complementary', { name: 'Your planning buddy' })
    const file = new File(['x'], 'Dropped.docx')
    fireEvent.drop(panel, { dataTransfer: { types: ['Files'], files: [file] } })
    await settled('Dropped.docx')
    expect(t.db['chat:attachPath']).toHaveBeenCalledWith({
      lessonId: LESSON,
      path: '/fake/Dropped.docx'
    })
  })

  it('attaches files pasted into the box', async () => {
    setupChat({
      deckBuilder: { 'chat:attachPath': () => ok({ attachment: attachment(3) }) }
    })
    const box = screen.getByRole('textbox', BOX)
    const paste = createEvent.paste(box, {
      clipboardData: { files: [new File(['x'], 'Notes 3.pdf')], getData: () => '' }
    })
    fireEvent(box, paste)
    await settled('Notes 3.pdf')
  })

  it('shows a card while a dropped file is being attached', async () => {
    let finish: (value: unknown) => void = () => undefined
    setupChat({
      deckBuilder: {
        'chat:attachPath': () => new Promise((resolve) => (finish = resolve)) as never
      }
    })
    const panel = screen.getByRole('complementary', { name: 'Your planning buddy' })
    fireEvent.drop(panel, {
      dataTransfer: { types: ['Files'], files: [new File(['x'], 'Slow.pdf')] }
    })
    expect(await screen.findByText('Uploading…')).toBeInTheDocument()
    finish(ok({ attachment: attachment(4) }))
    await waitFor(() => expect(screen.queryByText('Uploading…')).not.toBeInTheDocument())
  })

  it('stops at three files with a message', async () => {
    let n = 0
    const t = setupChat({
      deckBuilder: { 'chat:attach': () => ok({ attachment: attachment((n += 1)) }) }
    })
    for (let i = 0; i < 3; i += 1) {
      await t.user.click(screen.getByRole('button', { name: 'Attach a file' }))
      await screen.findByRole('group', { name: `Notes ${i + 1}.pdf` })
    }
    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeDisabled()
    const panel = screen.getByRole('complementary', { name: 'Your planning buddy' })
    fireEvent.drop(panel, {
      dataTransfer: { types: ['Files'], files: [new File(['x'], 'Fourth.pdf')] }
    })
    expect(await screen.findByText('You can attach up to 3 files.')).toBeInTheDocument()
    expect(t.db['chat:attachPath']).not.toHaveBeenCalled()
  })

  it('explains a file the browser gave no path for', async () => {
    setupChat({ api: { files: { pathFor: () => '' } } })
    const panel = screen.getByRole('complementary', { name: 'Your planning buddy' })
    fireEvent.drop(panel, {
      dataTransfer: { types: ['Files'], files: [new File(['x'], 'Image.png')] }
    })
    expect(await screen.findByText(/Couldn’t attach that/)).toBeInTheDocument()
  })
})

describe('EditorChat circled regions', () => {
  it('shows each draft as a chip, numbered, with the slide it is on', () => {
    setupChat({ props: { regions: [region(2), region(1, 's1')] } })
    expect(screen.getByText('Slide 1 · circled')).toBeInTheDocument()
    expect(screen.getByText('Slide 2 · circled')).toBeInTheDocument()
    expect(screen.getByRole('textbox', BOX)).toHaveAttribute(
      'placeholder',
      'Say what to change in the circled area…'
    )
  })

  it('removes a region with its ×', async () => {
    const t = setupChat({ props: { regions: [region(1), region(2)] } })
    await t.user.click(screen.getByRole('button', { name: 'Remove region 1' }))
    expect(t.props.onRegionsChange).toHaveBeenCalledWith([region(2)])
  })

  it('tells the stage which region to emphasise while its chip is hovered', async () => {
    const t = setupChat({ props: { regions: [region(1)] } })
    await t.user.hover(screen.getByText('Slide 2 · circled'))
    expect(t.props.onHighlightRegion).toHaveBeenLastCalledWith('r1')
    await t.user.unhover(screen.getByText('Slide 2 · circled'))
    expect(t.props.onHighlightRegion).toHaveBeenLastCalledWith(null)
  })

  it('does not send circles without words', async () => {
    const t = setupChat({ deckBuilder: STARTED, props: { regions: [region(1)] } })
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await t.user.type(screen.getByRole('textbox', BOX), '{Enter}')
    expect(t.db['chat:send']).not.toHaveBeenCalled()
  })

  it('sends the regions with the message and clears them', async () => {
    const t = setupChat({ deckBuilder: STARTED, props: { regions: [region(1)] } })
    await t.user.type(screen.getByRole('textbox', BOX), 'Swap this photo for a diagram{Enter}')
    expect(t.db['chat:send'].mock.calls[0][0].regions).toEqual([region(1)])
    expect(t.props.onRegionsChange).toHaveBeenCalledWith([])
    expect(screen.getByText('Swap this photo for a diagram')).toBeInTheDocument()
    t.rerender({ regions: [] })
    expect(screen.getAllByText('Slide 2 · circled')).toHaveLength(1)
  })

  it('gives the regions back with the text when main refuses the message', async () => {
    const t = setupChat({
      deckBuilder: { 'chat:send': () => ({ ok: false, code: 'invalid-input', message: 'Busy.' }) },
      props: { regions: [region(1)] }
    })
    await t.user.type(screen.getByRole('textbox', BOX), 'Swap this{Enter}')
    await screen.findByText('Busy.')
    expect(t.props.onRegionsChange).toHaveBeenLastCalledWith([region(1)])
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Swap this')
  })

  it('moves focus to the box when a region is added', () => {
    const t = setupChat()
    t.rerender({ regions: [region(1)] })
    expect(screen.getByRole('textbox', BOX)).toHaveFocus()
  })

  it('re-draws a sent region on the slide while its chip is hovered or focused', async () => {
    const sent = chatItem({
      id: 'u1',
      role: 'user',
      text: 'Swap this photo for a labelled diagram of a leaf cross-section.',
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
          caption: 'Swap this photo for a…'
        }
      ]
    })
    const t = setupChat({ props: { initialChat: [sent] } })
    await t.user.hover(screen.getByText('Slide 2 · circled'))
    expect(currentSentHighlight()).toMatchObject({
      n: 1,
      slideId: 's2',
      caption: 'Swap this photo for a…'
    })
    await t.user.unhover(screen.getByText('Slide 2 · circled'))
    expect(currentSentHighlight()).toBeNull()
  })

  it('does not re-draw a sent region whose slide was deleted', async () => {
    const sent = chatItem({
      id: 'u1',
      role: 'user',
      text: 'x',
      regions: [
        {
          n: 1,
          slideId: 'gone',
          slideNumber: 2,
          path: [
            [0, 0],
            [10, 0],
            [10, 10]
          ],
          caption: 'x'
        }
      ]
    })
    const t = setupChat({ props: { initialChat: [sent] } })
    await t.user.hover(screen.getByText('Slide 2 · removed'))
    expect(currentSentHighlight()).toBeNull()
  })

  it('selects the slide of a sent region when the editor allows it', async () => {
    const sent = chatItem({
      id: 'u1',
      role: 'user',
      text: 'x',
      regions: [
        {
          n: 1,
          slideId: 's3',
          slideNumber: 3,
          path: [
            [0, 0],
            [10, 0],
            [10, 10]
          ],
          caption: 'x'
        }
      ]
    })
    const calls: string[] = []
    const t = setupChat({ props: { initialChat: [sent], onSelectSlide: (id) => calls.push(id) } })
    await t.user.click(screen.getByRole('button', { name: 'Region 1 on slide 3' }))
    expect(calls).toEqual(['s3'])
  })
})

describe('EditorChat draft', () => {
  it('keeps the text when the plugin menu is opened and closed', async () => {
    const t = setupChat({ deckBuilder: { 'plugins:list': () => [] } })
    await t.user.type(screen.getByRole('textbox', BOX), 'Half a thought')
    await t.user.click(screen.getByRole('button', { name: 'Plugins' }))
    await t.user.keyboard('{Escape}')
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Half a thought')
  })

  it('uses a different deck without losing the draft', async () => {
    const t = setupChat()
    await t.user.type(screen.getByRole('textbox', BOX), 'Keep me')
    t.rerender({ deck: { ...fixtureDeck(), title: 'Renamed' } })
    expect(screen.getByRole('textbox', BOX)).toHaveValue('Keep me')
  })
})
