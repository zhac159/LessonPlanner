import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fail, ok } from '@shared/result'
import { LONG_TEXT_HINT } from './buildRequest'
import { CREATE_FAILED } from './hooks/useCreateLesson'
import { aiStatus, composer, makeButton, renderScreen } from './testing'

const PASTE = 'Photosynthesis, Y8 set 3. Lots of them mix up respiration and photosynthesis.'

describe('NewLessonScreen: the empty editor', () => {
  it('shows the empty stage, the buddy and the three ways to start', async () => {
    renderScreen()
    expect(
      screen.getByRole('heading', { name: 'Your slides will appear here' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Tell the planning buddy what you’re teaching/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start from a past lesson' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Blank slide' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'What are we teaching?' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Lesson set-up' })).toBeInTheDocument()
    expect(screen.getByText('Drop your learning objectives')).toBeInTheDocument()
    expect(await screen.findByText('Knows your Science KS3 style')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveAttribute(
      'placeholder',
      'Untitled lesson'
    )
  })

  it('keeps Present and Export disabled until there are slides', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: 'Present' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export to PowerPoint' })).toBeDisabled()
  })

  it('focuses the Composer when it opens', () => {
    renderScreen()
    expect(composer()).toHaveFocus()
    expect(composer()).toHaveAttribute('rows', '7')
  })

  it('goes back to My lessons', async () => {
    const { user, onBack } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'My lessons' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('uses the plain style wording when there are no styles', async () => {
    renderScreen({ library: { list: () => [] } })
    expect(await screen.findByText('Ready to plan with you')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Your style: Plain style/ })).toBeInTheDocument()
  })

  it('fills the text and title from Home’s card', () => {
    renderScreen({ props: { prefill: { title: 'Light', text: 'LO1: Describe light' } } })
    expect(composer()).toHaveValue('LO1: Describe light')
    expect(screen.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Light')
  })
})

describe('NewLessonScreen: set-up chips', () => {
  it('starts with 50 min, Mixed ability and about 8 slides, and no year', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /^Year group: Year group/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lesson length: 50 min/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ability: Mixed ability/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Number of slides: About 8 slides/ })
    ).toBeInTheDocument()
  })

  it('takes its defaults from the saved preferences', async () => {
    renderScreen({
      settings: {
        getPreferences: () => ({
          homeSort: 'edited',
          lastLengthMin: 60,
          lastYearGroup: 'Year 9',
          lastAbility: 'Higher ability',
          assetsMenuUses: 0
        })
      }
    })
    expect(await screen.findByRole('button', { name: /^Year group: Year 9/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lesson length: 60 min/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ability: Higher ability/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Number of slides: About 10 slides/ })).toBeVisible()
  })

  it('switches the Year chip when she pastes “Y8”', async () => {
    const { user } = renderScreen()
    await user.click(composer())
    await user.paste(PASTE)
    expect(screen.getByRole('button', { name: /^Year group: Year 8/ })).toBeInTheDocument()
  })

  it('reads a lesson length from the text and lets the slide count follow', async () => {
    const { user } = renderScreen()
    await user.click(composer())
    await user.paste('A 90 minute double lesson')
    expect(screen.getByRole('button', { name: /^Lesson length: 90 min/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Number of slides: About 15 slides/ })).toBeVisible()
  })

  it('lets her choose a year, and then no longer guesses it', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: /^Year group/ }))
    await user.click(screen.getByRole('option', { name: 'Year 10' }))
    await user.click(composer())
    await user.paste(PASTE)
    expect(screen.getByRole('button', { name: /^Year group: Year 10/ })).toBeInTheDocument()
  })

  it('moves the slide count with the length until she picks a count', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: /^Lesson length/ }))
    await user.click(screen.getByRole('option', { name: '75 min' }))
    expect(screen.getByRole('button', { name: /^Number of slides: About 12 slides/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^Number of slides/ }))
    await user.click(screen.getByRole('option', { name: 'About 6 slides' }))
    await user.click(screen.getByRole('button', { name: /^Lesson length/ }))
    await user.click(screen.getByRole('option', { name: '90 min' }))
    expect(screen.getByRole('button', { name: /^Number of slides: About 6 slides/ })).toBeVisible()
  })
})

describe('NewLessonScreen: Make my slides', () => {
  it('stays disabled until there is text or a document', async () => {
    const { user } = renderScreen()
    expect(makeButton()).toBeDisabled()
    await user.type(composer(), 'LO1')
    expect(makeButton()).toBeEnabled()
  })

  it('creates the lesson with the set-up and opens it', async () => {
    const { user, deckBuilder, settings, onOpenLesson } = renderScreen()
    await user.click(composer())
    await user.paste(PASTE)
    await user.click(makeButton())
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_new'))
    expect(deckBuilder.createLesson).toHaveBeenCalledWith({
      objectivesText: PASTE,
      documentIds: [],
      styleId: 'sty_science',
      title: null,
      meta: { yearGroup: 'Year 8', durationMin: 50, ability: 'Mixed ability', targetSlideCount: 8 },
      startGeneration: true
    })
    expect(settings.setPreferences).toHaveBeenCalledWith({
      lastYearGroup: 'Year 8',
      lastLengthMin: 50,
      lastAbility: 'Mixed ability'
    })
  })

  it('sends the title she typed', async () => {
    const { user, deckBuilder } = renderScreen()
    await user.type(screen.getByRole('textbox', { name: 'Lesson title' }), 'Light and sound{Enter}')
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    await waitFor(() =>
      expect(deckBuilder.createLesson).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Light and sound' })
      )
    )
  })

  it('adds a new line on Enter and makes the slides on Ctrl+Enter', async () => {
    const { user, deckBuilder, onOpenLesson } = renderScreen()
    await user.type(composer(), 'LO1{Enter}LO2')
    expect(composer()).toHaveValue('LO1\nLO2')
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_new'))
    expect(deckBuilder.createLesson).toHaveBeenCalledWith(
      expect.objectContaining({ objectivesText: 'LO1\nLO2' })
    )
  })

  it('does nothing on Ctrl+Enter with an empty Composer', async () => {
    const { user, deckBuilder } = renderScreen()
    await user.click(composer())
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
  })

  it('shows that it is starting, and ignores a second press', async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {}
    const createLesson = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve
        })
    )
    const { user, onOpenLesson } = renderScreen({
      deckBuilder: { createLesson: createLesson as never }
    })
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    expect(await screen.findByText('Starting your lesson…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blank slide' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Starting…' }))
    expect(createLesson).toHaveBeenCalledTimes(1)
    finish(ok({ lessonId: 'les_late', jobId: null, messageId: null }))
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_late'))
  })

  it('warns about a very long paste', () => {
    renderScreen()
    fireEvent.change(composer(), { target: { value: 'a'.repeat(20_001) } })
    expect(screen.getByText(LONG_TEXT_HINT)).toBeInTheDocument()
  })
})

describe('NewLessonScreen: no key', () => {
  it('shows the Connect Claude prompt, sends nothing and keeps the text', async () => {
    const { user, deckBuilder, shell } = renderScreen({
      settings: { getAiStatus: () => aiStatus({ hasKey: false, keyLast4: null }) }
    })
    await user.type(composer(), 'LO1: Describe light')
    await user.click(makeButton())
    expect(screen.getByText('Connect Claude to use this.')).toBeInTheDocument()
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
    expect(composer()).toHaveValue('LO1: Describe light')
    await user.click(screen.getByRole('button', { name: 'Connect Claude' }))
    expect(shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })

  it('treats a key that failed its last test as no key', async () => {
    const { user, deckBuilder } = renderScreen({
      settings: { getAiStatus: () => aiStatus({ lastTest: { result: 'invalid-key', at: 'now' } }) }
    })
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    expect(screen.getByText('Connect Claude to use this.')).toBeInTheDocument()
    expect(deckBuilder.createLesson).not.toHaveBeenCalled()
  })

  it('still lets her start a blank slide', async () => {
    const { user, deckBuilder, onOpenLesson } = renderScreen({
      settings: { getAiStatus: () => aiStatus({ hasKey: false }) }
    })
    await user.click(screen.getByRole('button', { name: 'Blank slide' }))
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_new'))
    expect(deckBuilder.createLesson).toHaveBeenCalled()
  })

  it('takes the prompt away once Claude is connected', async () => {
    const { user, clients } = renderScreen({
      settings: { getAiStatus: () => aiStatus({ hasKey: false }) }
    })
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    expect(screen.getByText('Connect Claude to use this.')).toBeInTheDocument()
    clients.emit('settings', 'aiStatusChanged', aiStatus())
    await waitFor(() =>
      expect(screen.queryByText('Connect Claude to use this.')).not.toBeInTheDocument()
    )
  })
})

describe('NewLessonScreen: errors and offline', () => {
  it('says why it failed, keeps the draft and offers Try again', async () => {
    const createLesson = vi
      .fn()
      .mockResolvedValueOnce(
        fail('rate-limited', 'Claude is busy right now. Try again in a minute.')
      )
      .mockResolvedValueOnce(ok({ lessonId: 'les_2', jobId: null, messageId: null }))
    const { user, onOpenLesson } = renderScreen({ deckBuilder: { createLesson } })
    await user.type(composer(), 'LO1: Describe light')
    await user.click(makeButton())
    expect(
      await screen.findByText('Claude is busy right now. Try again in a minute.')
    ).toBeInTheDocument()
    expect(composer()).toHaveValue('LO1: Describe light')
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(onOpenLesson).toHaveBeenCalledWith('les_2'))
    expect(createLesson).toHaveBeenCalledTimes(2)
  })

  it('shows the Offline pill when Claude cannot be reached', async () => {
    const { user } = renderScreen({
      deckBuilder: {
        createLesson: () => fail('network', 'Can’t reach Claude. Check your internet connection.')
      }
    })
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    expect(
      await screen.findByText('Can’t reach Claude. Check your internet connection.')
    ).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(composer()).toHaveValue('LO1')
  })

  it('shows the Offline pill while the computer has no network', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderScreen()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    fireEvent(window, new Event('online'))
    online.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    expect(screen.queryByText('Offline')).not.toBeInTheDocument()
    online.mockRestore()
  })

  it('explains a request main could not even answer', async () => {
    const { user, onOpenLesson } = renderScreen({
      deckBuilder: {
        createLesson: () => {
          throw new Error('IPC down')
        }
      }
    })
    await user.type(composer(), 'LO1')
    await user.click(makeButton())
    expect(await screen.findByText(CREATE_FAILED)).toBeInTheDocument()
    expect(onOpenLesson).not.toHaveBeenCalled()
    expect(makeButton()).toBeEnabled()
  })
})
