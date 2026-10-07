import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LessonSummary } from '@shared/contracts/deck-builder'
import { lesson, NOT_CONNECTED, CONNECTED, style } from './testSupport'
import { renderHome } from './renderHome'

const NOW = new Date('2026-10-06T09:30:00')
const LESSONS = [
  lesson({
    id: 'a',
    title: 'Photosynthesis',
    yearGroup: 'Year 8',
    yearShort: 'Year 8',
    updatedAt: '2026-10-06T08:00:00'
  }),
  lesson({
    id: 'b',
    title: 'Cells and organelles',
    yearGroup: 'Year 7',
    yearShort: 'Year 7',
    updatedAt: '2026-10-05T08:00:00'
  }),
  lesson({
    id: 'c',
    title: 'Staying safe online',
    yearGroup: 'Form time',
    yearShort: 'Form',
    updatedAt: '2026-09-20T08:00:00'
  })
]
const STYLES = [
  style(),
  style({ id: 's2', name: 'Form time', isDefault: false, titleFont: 'Nunito', deckCount: 6 })
]

/** The titles of the lesson cards, in grid order (each card's button is named by its title element). */
const cardTitles = (): string[] =>
  within(screen.getByRole('list', { name: 'Past lessons' }))
    .getAllByRole('listitem')
    .map((item) => {
      const button = within(item).getAllByRole('button')[0]
      return (
        document.getElementById(button.getAttribute('aria-labelledby') ?? '')?.textContent ?? ''
      )
    })

afterEach(() => {
  vi.useRealTimers()
})

describe('HomeView greeting', () => {
  it.each([
    ['2026-10-06T08:00:00', 'Good morning, Alice!'],
    ['2026-10-06T11:59:00', 'Good morning, Alice!'],
    ['2026-10-06T12:00:00', 'Good afternoon, Alice!'],
    ['2026-10-06T17:59:00', 'Good afternoon, Alice!'],
    ['2026-10-06T18:00:00', 'Good evening, Alice!']
  ])('at %s says "%s"', (time, text) => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(time) })
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(text)
  })

  it('drops the name when the profile has none', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW })
    renderHome({}, { user: null })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning!')
  })

  it('re-evaluates every minute while visible', () => {
    vi.useFakeTimers({ now: new Date('2026-10-06T11:59:30') })
    renderHome()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Alice!')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good afternoon, Alice!')
  })
})

describe('HomeView loading and data', () => {
  it('shows the greeting and skeletons at once, before anything has loaded', async () => {
    const never = new Promise<LessonSummary[]>(() => {})
    renderHome({ deckBuilder: { listLessons: () => never } })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('lessons-loading').children).toHaveLength(8)
    expect(screen.queryByRole('group', { name: 'Filter by year group' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument()
  })

  it('shows lessons, styles and a filter chip per year group', async () => {
    renderHome({ lessons: LESSONS, styles: STYLES })
    expect(await screen.findByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Science KS3' })).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'Filter by year group' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['All', 'Year 7', 'Year 8', 'Form time'])
    expect(screen.getByText('Form')).toBeInTheDocument()
  })

  it('shows both empty states and no filters for a brand-new teacher', async () => {
    renderHome({ lessons: [], styles: [], status: NOT_CONNECTED })
    expect(await screen.findByText('No lessons yet')).toBeInTheDocument()
    expect(
      screen.getByText('Teach me your style first so new lessons look like yours.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Style: Plain style/ })).toBeInTheDocument()
    expect(
      await screen.findAllByText('Claude isn’t connected yet, so I can’t make slides.')
    ).toHaveLength(1)
  })

  it('shows a recoverable error for lessons while the rest of the page works', async () => {
    let fail = true
    const { deckBuilder } = renderHome({
      styles: STYLES,
      lessons: LESSONS,
      deckBuilder: {
        listLessons: () => {
          if (fail) throw new Error('boom')
          return LESSONS
        }
      }
    })
    expect(await screen.findByText('I couldn’t load your lessons.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Science KS3' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Learning objectives' })).toBeEnabled()
    fail = false
    await act(async () => screen.getByRole('button', { name: 'Try again' }).click())
    expect(await screen.findByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
    expect(deckBuilder.listLessons).toHaveBeenCalledTimes(2)
  })

  it('treats a failed styles read as no styles', async () => {
    renderHome({ styles: new Error('nope'), lessons: LESSONS })
    expect(await screen.findByText(/Teach me your style first/)).toBeInTheDocument()
  })

  it('shows a damaged lesson as a card with a way out', async () => {
    renderHome({ lessons: [...LESSONS, lesson({ id: 'x', title: 'Broken', damaged: true })] })
    expect(await screen.findByRole('article', { name: 'Broken' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
  })

  it('lists modules that failed to load at the bottom, only when there are issues', async () => {
    const { unmount } = renderHome({ lessons: LESSONS })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    expect(screen.queryByText('Modules that failed to load')).not.toBeInTheDocument()
    unmount()
    renderHome(
      { lessons: LESSONS },
      { issues: [{ moduleId: 'plugins', path: 'p', message: 'broke' }] }
    )
    expect(await screen.findByText('Modules that failed to load')).toBeInTheDocument()
    expect(screen.getByText('plugins: broke')).toBeInTheDocument()
  })
})

describe('HomeView connection', () => {
  it('shows the Connect Claude callout when the key is missing and goes to Settings', async () => {
    const { shell, user } = renderHome({ status: NOT_CONNECTED })
    await screen.findByText('Claude isn’t connected yet, so I can’t make slides.')
    await user.click(screen.getByRole('button', { name: 'Connect Claude' }))
    expect(shell.navigate).toHaveBeenCalledWith('settings', { kind: 'ai' })
  })

  it('treats an invalid key as not connected', async () => {
    renderHome({ status: { ...CONNECTED, lastTest: { result: 'invalid-key', at: 'x' } } })
    expect(
      await screen.findByText('Claude isn’t connected yet, so I can’t make slides.')
    ).toBeInTheDocument()
  })

  it('shows no callout when connected', async () => {
    const { settings } = renderHome({ lessons: LESSONS })
    await waitFor(() => expect(settings.getAiStatus).toHaveBeenCalled())
    expect(screen.queryByText(/Claude isn’t connected yet/)).not.toBeInTheDocument()
  })

  it('reacts to the connection changing', async () => {
    const { clients } = renderHome({ status: NOT_CONNECTED })
    await screen.findByText('Claude isn’t connected yet, so I can’t make slides.')
    act(() => clients.emit('settings', 'aiStatusChanged', CONNECTED))
    await waitFor(() =>
      expect(screen.queryByText(/Claude isn’t connected yet/)).not.toBeInTheDocument()
    )
  })
})

describe('HomeView live refresh', () => {
  it('replaces the lessons when main says they changed', async () => {
    const { clients } = renderHome({ lessons: LESSONS })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    act(() =>
      clients.emit('deck-builder', 'lessonsChanged', [
        lesson({ id: 'n', title: 'Brand new', yearGroup: 'Year 9', yearShort: 'Year 9' })
      ])
    )
    expect(await screen.findByRole('button', { name: 'Brand new' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Photosynthesis' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year 9' })).toBeInTheDocument()
  })

  it('replaces the styles when the library changes', async () => {
    const { clients } = renderHome({ styles: STYLES })
    await screen.findByRole('button', { name: 'Science KS3' })
    act(() => clients.emit('style-library', 'changed', [style({ id: 's9', name: 'Maths' })]))
    expect(await screen.findByRole('button', { name: 'Maths' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Science KS3' })).not.toBeInTheDocument()
  })

  it('reads the lists again each time Home becomes visible', async () => {
    const { deckBuilder, library, rerenderActive } = renderHome({ lessons: LESSONS }, {}, false)
    expect(deckBuilder.listLessons).not.toHaveBeenCalled()
    rerenderActive(true)
    await waitFor(() => expect(deckBuilder.listLessons).toHaveBeenCalledTimes(1))
    rerenderActive(false)
    rerenderActive(true)
    await waitFor(() => expect(deckBuilder.listLessons).toHaveBeenCalledTimes(2))
    expect(library.list).toHaveBeenCalledTimes(2)
  })

  it('keeps showing lessons when a later refresh fails', async () => {
    let calls = 0
    const { rerenderActive } = renderHome({
      deckBuilder: {
        listLessons: () => {
          calls += 1
          if (calls > 1) throw new Error('late')
          return LESSONS
        }
      }
    })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    rerenderActive(false)
    rerenderActive(true)
    await waitFor(() => expect(calls).toBe(2))
    expect(screen.getByRole('button', { name: 'Photosynthesis' })).toBeInTheDocument()
    expect(screen.queryByText('I couldn’t load your lessons.')).not.toBeInTheDocument()
  })
})

describe('HomeView navigation', () => {
  it('opens a lesson in the editor', async () => {
    const { shell, user } = renderHome({ lessons: LESSONS })
    await user.click(await screen.findByRole('button', { name: 'Cells and organelles' }))
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', {
      kind: 'open-lesson',
      lessonId: 'b'
    })
  })

  it('opens the empty New lesson screen from the header', async () => {
    const { shell, user } = renderHome()
    await user.click(screen.getByRole('button', { name: 'New lesson' }))
    expect(shell.navigate).toHaveBeenCalledWith('deck-builder', { kind: 'new-lesson' })
  })

  it('opens a style for editing and the Styles list from Manage', async () => {
    const { shell, user } = renderHome({ styles: STYLES })
    await user.click(await screen.findByRole('button', { name: 'Form time' }))
    expect(shell.navigate).toHaveBeenCalledWith('style-library', {
      kind: 'edit-style',
      styleId: 's2'
    })
    await user.click(screen.getByRole('button', { name: 'Manage' }))
    expect(shell.navigate).toHaveBeenCalledWith('style-library')
  })
})

describe('HomeView filter and sort', () => {
  it('filters by year group and returns to All when the chip is pressed again', async () => {
    const { user } = renderHome({ lessons: LESSONS })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    const group = screen.getByRole('group', { name: 'Filter by year group' })
    await user.click(within(group).getByRole('button', { name: 'Year 7' }))
    expect(cardTitles()).toEqual(['Cells and organelles'])
    expect(within(group).getByRole('button', { name: 'Year 7' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await user.click(within(group).getByRole('button', { name: 'Year 7' }))
    expect(cardTitles()).toHaveLength(3)
    await user.click(within(group).getByRole('button', { name: 'Year 8' }))
    await user.click(within(group).getByRole('button', { name: 'All' }))
    expect(cardTitles()).toHaveLength(3)
  })

  it('falls back to All when the selected year group disappears', async () => {
    const { user, clients } = renderHome({ lessons: LESSONS })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    await user.click(screen.getByRole('button', { name: 'Year 7' }))
    act(() => clients.emit('deck-builder', 'lessonsChanged', [LESSONS[0]]))
    await waitFor(() => expect(cardTitles()).toEqual(['Photosynthesis']))
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sorts newest first by default and by title when asked, and remembers the choice', async () => {
    const { user, settings } = renderHome({ lessons: LESSONS })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    expect(cardTitles()).toEqual(['Photosynthesis', 'Cells and organelles', 'Staying safe online'])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'title')
    expect(cardTitles()).toEqual(['Cells and organelles', 'Photosynthesis', 'Staying safe online'])
    expect(settings.setPreferences).toHaveBeenCalledWith({ homeSort: 'title' })
  })

  it('starts with the saved sort order', async () => {
    renderHome({ lessons: LESSONS, prefs: { homeSort: 'year' } })
    await screen.findByRole('button', { name: 'Photosynthesis' })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Sort' })).toHaveValue('year'))
    expect(cardTitles()).toEqual(['Cells and organelles', 'Photosynthesis', 'Staying safe online'])
  })
})
