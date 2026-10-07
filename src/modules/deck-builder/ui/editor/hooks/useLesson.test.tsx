import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DeckBuilderApi, LessonView } from '@shared/contracts/deck-builder'
import { fixtureDeck } from '@shared/deck/testing'
import { fail, ok } from '@shared/result'
import { createFakeClients, fakeClient } from '@test/render'
import { FakeLesson, LESSON, hookWrapper } from '../testing'
import { useLesson } from './useLesson'

const setup = (openLesson: DeckBuilderApi['openLesson']) => {
  const clients = createFakeClients({ 'deck-builder': fakeClient<DeckBuilderApi>({ openLesson }) })
  return renderHook(({ token }) => useLesson(LESSON, token), {
    initialProps: { token: 0 },
    wrapper: hookWrapper(clients)
  })
}

describe('useLesson', () => {
  it('starts loading, then holds the opened lesson', async () => {
    const lesson = new FakeLesson()
    const { result } = setup(() => ok(lesson.view()))
    expect(result.current.load.status).toBe('loading')
    expect(result.current.snapshot).toBeNull()
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    expect(result.current.snapshot?.deck.slides).toHaveLength(3)
    expect(result.current.latest.current?.history.canUndo).toBe(false)
  })

  it('reports a failure to open, from a Result or a rejection', async () => {
    const failed = setup(() => fail('not-found', 'gone'))
    await waitFor(() =>
      expect(failed.result.current.load).toEqual({ status: 'error', message: 'gone' })
    )
    const thrown = setup(() => {
      throw new Error('boom')
    })
    await waitFor(() => expect(thrown.result.current.load.status).toBe('error'))
  })

  it('commit replaces the deck and history at once', async () => {
    const lesson = new FakeLesson()
    const { result } = setup(() => ok(lesson.view()))
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    const deck = { ...fixtureDeck(), title: 'Committed' }
    act(() => result.current.commit({ deck, history: { ...lesson.history(), canUndo: true } }))
    expect(result.current.snapshot?.deck.title).toBe('Committed')
    expect(result.current.latest.current?.history.canUndo).toBe(true)
  })

  it('refresh re-reads deck, history and style', async () => {
    const lesson = new FakeLesson()
    const { result } = setup(() => ok(lesson.view()))
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    lesson.deck = { ...lesson.deck, title: 'Changed elsewhere' }
    await act(() => result.current.refresh())
    expect(result.current.snapshot?.deck.title).toBe('Changed elsewhere')
  })

  it('a slow refresh never overwrites a newer commit', async () => {
    const lesson = new FakeLesson()
    let release: (view: LessonView) => void = () => {}
    let calls = 0
    const { result } = setup((() => {
      calls += 1
      return calls === 1
        ? ok(lesson.view())
        : new Promise((resolve) => (release = (v) => resolve(ok(v))))
    }) as never)
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    let refreshing: Promise<void> = Promise.resolve()
    act(() => {
      refreshing = result.current.refresh()
    })
    act(() =>
      result.current.commit({
        deck: { ...fixtureDeck(), title: 'Newer' },
        history: lesson.history()
      })
    )
    await act(async () => {
      release(lesson.view())
      await refreshing
    })
    expect(result.current.snapshot?.deck.title).toBe('Newer')
  })

  it('a failed refresh leaves the lesson as it was', async () => {
    const lesson = new FakeLesson()
    let calls = 0
    const { result } = setup((() => {
      calls += 1
      if (calls === 1) return ok(lesson.view())
      throw new Error('ipc')
    }) as never)
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    await act(() => result.current.refresh())
    expect(result.current.load.status).toBe('ready')
    expect(result.current.snapshot?.deck.slides).toHaveLength(3)
  })

  it('opens again when the reload token changes, without going back to loading', async () => {
    const lesson = new FakeLesson()
    let calls = 0
    const { result, rerender } = setup(() => {
      calls += 1
      return ok(lesson.view())
    })
    await waitFor(() => expect(result.current.load.status).toBe('ready'))
    rerender({ token: 1 })
    expect(result.current.load.status).toBe('ready')
    await waitFor(() => expect(calls).toBe(2))
  })
})
