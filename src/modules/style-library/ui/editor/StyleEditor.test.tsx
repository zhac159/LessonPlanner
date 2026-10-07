import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StyleFile } from '@shared/contracts/style-library'
import { designFiles, makeFile, makeProfileView, makeView, progressOf } from '../testSupport'
import { renderEditor } from './testHarness'

const designView = () => makeView(designFiles(), { name: 'Science KS3', isDefault: true })

describe('StyleEditor: default (learning) state', () => {
  it('matches the design: header, progress, rows and panel', async () => {
    renderEditor({ view: designView() })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Create a style' })
    ).toBeInTheDocument()
    expect(screen.getByText('Learning · 6 of 8 files')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save style' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Your files' })).toBeInTheDocument()
    expect(screen.getByText('8 files')).toBeInTheDocument()
    expect(screen.getByText('6 of 8 learned')).toBeInTheDocument()
    expect(screen.getByText('About a minute left')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '6 of 8 learned' })).toHaveAttribute(
      'aria-valuenow',
      '6'
    )
    expect(screen.getAllByText('Learned')).toHaveLength(6)
    expect(screen.getByText('Reading…')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.getByText('14 slides')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove Y8 Photosynthesis.pptx' })
    ).toBeInTheDocument()
    expect(screen.getByText(/10 or more decks gives the closest match/)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Each file is sent to Claude to learn your style. A copy is kept on this computer.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'What I’ve learned so far' })).toBeInTheDocument()
    expect(screen.getByText('Updates as each file is read')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Style name' })).toHaveValue('Science KS3')
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).toBeChecked()
    for (const card of [
      'Colours',
      'Fonts',
      'Layout habits',
      'Slide types you use',
      'How you write'
    ]) {
      expect(screen.getByRole('heading', { name: card })).toBeInTheDocument()
    }
    expect(screen.getByRole('region', { name: 'Test slide in this style' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Anything I got wrong?' })).toBeEnabled()
  })

  it('shows the loading state, then the style', async () => {
    renderEditor({ view: designView() })
    expect(screen.getByRole('status')).toHaveTextContent('Loading your style…')
    expect(await screen.findByRole('heading', { name: 'Your files' })).toBeInTheDocument()
  })

  it('reports a style that cannot be loaded', async () => {
    const { user, shell } = renderEditor({ view: null, styleId: 'gone' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Style not found')
    await user.click(screen.getByRole('button', { name: 'Back to Home' }))
    expect(shell.navigate).toHaveBeenCalledWith('home')
  })
})

describe('StyleEditor: empty draft', () => {
  it('has a taller dropzone, no pill, no progress and a disabled Save', () => {
    renderEditor({ view: null, firstStyle: true })
    expect(screen.getByRole('button', { name: /Add your PDFs or PowerPoints/ })).toBeInTheDocument()
    expect(screen.queryByText(/Learning ·/)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText('0 files')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled()
    expect(
      screen.getByText('Add a few of your decks and I’ll show you what I learn here.')
    ).toBeInTheDocument()
    expect(screen.getByText(/10 or more decks/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Style name' })).toHaveValue('My style')
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).toBeChecked()
  })

  it('starts the name from her subject and leaves the default unticked with other styles', () => {
    renderEditor({ view: null, props: { subject: 'Science' }, firstStyle: false })
    expect(screen.getByRole('textbox', { name: 'Style name' })).toHaveValue('Science')
    expect(screen.getByRole('checkbox', { name: 'Make this my default style' })).not.toBeChecked()
  })
})

describe('StyleEditor: files queued, none learned yet', () => {
  const waiting = [
    makeFile({ id: 'a', name: 'A.pptx', status: 'reading', units: null }),
    makeFile({ id: 'b', name: 'B.pdf', kind: 'pdf', status: 'waiting', units: null })
  ]

  it('shows 0 of n learned, skeletons, the test slide placeholder and a disabled Save', async () => {
    renderEditor({ view: makeView(waiting) })
    expect(await screen.findByText('0 of 2 learned')).toBeInTheDocument()
    expect(screen.getByText('Learning · 0 of 2 files')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled()
    expect(screen.getByText('Your test slide appears after the first file.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Colours' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('textbox', { name: 'Anything I got wrong?' })).toBeDisabled()
  })
})

describe('StyleEditor: finished, partial and failed', () => {
  it('shows the done pill and how many files could not be read', async () => {
    const files = [
      makeFile({ id: 'a' }),
      makeFile({
        id: 'b',
        name: 'Locked.pdf',
        kind: 'pdf',
        status: 'failed',
        error: { code: 'password', message: 'Password protected', retryable: false }
      })
    ]
    renderEditor({ view: makeView(files) })
    expect(await screen.findByText('Learned from 1 file')).toBeInTheDocument()
    expect(screen.getByText('1 file couldn’t be read')).toBeInTheDocument()
    expect(screen.getByText('Couldn’t read')).toBeInTheDocument()
    expect(screen.getByText('Password protected')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.queryByRole('button', { name: /Try Locked.pdf again/ })).not.toBeInTheDocument()
  })

  it('offers a retry for a retryable failure', async () => {
    const failed = makeFile({
      id: 'b',
      name: 'Busy.pdf',
      kind: 'pdf',
      status: 'failed',
      error: { code: 'overloaded', message: 'Claude was busy', retryable: true }
    })
    const { user, styles } = renderEditor({ view: makeView([makeFile(), failed]) })
    await user.click(await screen.findByRole('button', { name: 'Try Busy.pdf again' }))
    expect(styles.retryFile).toHaveBeenCalledWith({ styleId: 'sty_1', fileId: 'b' })
  })

  it('explains when every file failed and keeps Save disabled', async () => {
    const files = [
      makeFile({
        id: 'a',
        status: 'failed',
        error: { code: 'corrupt', message: 'This file is damaged', retryable: false }
      })
    ]
    renderEditor({ view: makeView(files) })
    expect(
      await screen.findByText(
        'I couldn’t read any of these files. Try PowerPoint files or PDFs exported from PowerPoint.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save style' })).toBeDisabled()
    expect(screen.queryByText(/Learned from/)).not.toBeInTheDocument()
    expect(screen.getByText(/Add a few of your decks/)).toBeInTheDocument()
  })

  it('warns about pupil names and flags the rows', async () => {
    renderEditor({ view: makeView([makeFile({ mayContainNames: true })]) })
    expect(await screen.findByText(/Some slides may contain pupil names/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'May contain pupil names' })).toBeInTheDocument()
  })

  it('draws the test slide from Claude’s slide when there is one', async () => {
    const own = makeProfileView({
      version: 4,
      testSlide: {
        id: 'claude',
        kind: 'content',
        elements: [
          {
            id: 't',
            type: 'text',
            role: 'title',
            x: 100,
            y: 100,
            w: 800,
            h: 100,
            paragraphs: [{ runs: [{ text: 'Claude slide' }] }]
          }
        ]
      }
    })
    renderEditor({ view: makeView([makeFile()], { profile: own }) })
    const region = await screen.findByRole('region', { name: 'Test slide in this style' })
    expect(within(region).getByText('Claude slide')).toBeInTheDocument()
  })
})

describe('StyleEditor: paused queue', () => {
  const paused = (code: 'no-key' | 'no-credit' | 'invalid-key') => {
    const files: StyleFile[] = [makeFile(), makeFile({ id: 'b', status: 'waiting' })]
    return makeView(files, {
      progress: progressOf(files, { stage: 'paused', pausedFor: code, etaSeconds: null })
    })
  }

  it('shows the credit message with a link, a Paused pill and Carry on', async () => {
    const { user, styles } = renderEditor({ view: paused('no-credit') })
    expect(await screen.findByText('Your Claude account is out of credit.')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open platform.claude.com ↗' })).toHaveAttribute(
      'href',
      'https://platform.claude.com/'
    )
    await user.click(screen.getByRole('button', { name: 'Carry on' }))
    expect(styles.resume).toHaveBeenCalledWith({ styleId: 'sty_1' })
  })

  it('offers Connect Claude when there is no key and goes to Settings', async () => {
    const { user, shell } = renderEditor({ view: paused('no-key') })
    await user.click(await screen.findByRole('button', { name: 'Connect Claude' }))
    expect(shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })

  it('offers Open Settings for a rejected key', async () => {
    renderEditor({ view: paused('invalid-key') })
    expect(await screen.findByRole('button', { name: 'Open Settings' })).toBeInTheDocument()
  })
})

describe('StyleEditor: live progress', () => {
  it('updates a file and the panel from progress events, without a reload', async () => {
    const first = makeFile({ id: 'f0', name: 'One.pptx' })
    const second = makeFile({ id: 'f1', name: 'Two.pptx', status: 'reading' })
    const { clients, styles } = renderEditor({ view: makeView([first, second]) })
    await screen.findByText('1 of 2 learned')
    const done = { ...second, status: 'learned' as const }
    act(() => {
      clients.emit('style-library', 'progress', {
        styleId: 'sty_1',
        file: done,
        progress: progressOf([first, done]),
        partialProfile: makeProfileView({ habits: ['A brand new habit'] })
      })
    })
    expect(await screen.findByText('2 of 2 learned')).toBeInTheDocument()
    expect(screen.getByText('A brand new habit')).toBeInTheDocument()
    expect(screen.getByText('Learned from 2 files')).toBeInTheDocument()
    expect(styles.get).toHaveBeenCalledTimes(1)
  })

  it('announces each learned file politely, by name', async () => {
    const reading = [makeFile({ id: 'a', name: 'Waves.pptx', status: 'reading' })]
    const { clients } = renderEditor({ view: makeView(reading) })
    await screen.findByText('0 of 1 learned')
    act(() => {
      const learned = { ...reading[0], status: 'learned' as const }
      clients.emit('style-library', 'progress', {
        styleId: 'sty_1',
        file: learned,
        progress: progressOf([learned])
      })
    })
    const live = document.querySelector('.sr-only[aria-live="polite"]')
    expect(live).toHaveTextContent('Learned from Waves.pptx')
  })

  it('ignores events for another style', async () => {
    const { clients } = renderEditor({ view: makeView([makeFile()]) })
    await screen.findByText('1 of 1 learned')
    act(() => {
      clients.emit('style-library', 'progress', { styleId: 'other', progress: progressOf([]) })
    })
    expect(screen.getByText('1 of 1 learned')).toBeInTheDocument()
  })

  it('reloads the whole style when the counts disagree (a removal in another window)', async () => {
    const { clients, styles } = renderEditor({
      view: makeView([makeFile({ id: 'a' }), makeFile({ id: 'b' })])
    })
    await screen.findByText('2 of 2 learned')
    act(() => {
      clients.emit('style-library', 'progress', {
        styleId: 'sty_1',
        progress: progressOf([makeFile({ id: 'a' })])
      })
    })
    await waitFor(() => expect(styles.get).toHaveBeenCalledTimes(2))
  })
})

describe('StyleEditor: edit mode', () => {
  it('uses the edit title, "Save changes" and the learned pill', async () => {
    renderEditor({ view: designView(), mode: 'edit' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit style' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})
