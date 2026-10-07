import { act, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DeckBuilderApi } from '@shared/contracts/deck-builder'
import { fixtureDeck } from '@shared/deck/testing'
import { fail, ok } from '@shared/result'
import { createFakeClients, fakeClient } from '@test/render'
import { moveSlidePlan } from '../logic/changes'
import { FakeLesson, LESSON, hookWrapper } from '../testing'
import { useDeckEdits } from './useDeckEdits'

function setup(overrides: Partial<DeckBuilderApi> = {}) {
  const lesson = new FakeLesson()
  const latest = { current: { deck: lesson.deck, history: lesson.history() } }
  const commit = vi.fn((next: typeof latest.current) => {
    latest.current = next
  })
  const refresh = vi.fn(async () => {})
  const client = fakeClient<DeckBuilderApi>({
    applyOps: lesson.applyOps,
    undo: lesson.undo,
    redo: lesson.redo,
    renameLesson: () => ok({ lesson: { id: LESSON, title: 'x' } as never }),
    ...overrides
  })
  const clients = createFakeClients({ 'deck-builder': client })
  const hook = renderHook(() => useDeckEdits(LESSON, { latest, commit, refresh }), {
    wrapper: hookWrapper(clients)
  })
  return { ...hook, lesson, commit, refresh, latest, client }
}

describe('useDeckEdits', () => {
  it('applies a plan through main and commits the resulting deck and history', async () => {
    const { result, commit } = setup()
    let done = false
    await act(async () => {
      done = await result.current.apply(moveSlidePlan('s1', 's2'))
    })
    expect(done).toBe(true)
    const next = commit.mock.calls[0][0]
    expect(next.deck.slides.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    expect(next.history.canUndo).toBe(true)
  })

  it('runs plans one after another, each made from the deck the last one produced', async () => {
    const { result, commit } = setup()
    await act(async () => {
      await Promise.all([
        result.current.apply((deck) => moveSlidePlan(deck.slides[0].id, deck.slides[1].id)),
        result.current.apply((deck) => moveSlidePlan(deck.slides[0].id, deck.slides[1].id))
      ])
    })
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit.mock.calls[1][0].deck.slides.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
  })

  it('skips a function that has nothing to do', async () => {
    const { result, client } = setup()
    let done = true
    await act(async () => {
      done = await result.current.apply(() => null)
    })
    expect(done).toBe(false)
    expect(client.applyOps).not.toHaveBeenCalled()
  })

  it('tells her when main refuses, and does not commit', async () => {
    const { result, commit } = setup({ applyOps: () => fail('invalid-input', 'Not allowed') })
    let done = true
    await act(async () => {
      done = await result.current.apply(moveSlidePlan('s1', null))
    })
    expect(done).toBe(false)
    expect(commit).not.toHaveBeenCalled()
    expect(await screen.findByText('Not allowed')).toBeInTheDocument()
  })

  it('re-reads the lesson when the ChangeSet cannot be applied locally', async () => {
    const lesson = new FakeLesson()
    const { result, refresh, commit } = setup({
      applyOps: (args) => {
        const reply = lesson.applyOps(args)
        return reply.ok
          ? ok({
              ...reply,
              changeSet: {
                ...reply.changeSet,
                ops: [{ op: 'deleteSlides', slideIds: ['missing'] }]
              }
            })
          : reply
      }
    })
    await act(async () => {
      await result.current.apply(moveSlidePlan('s1', null))
    })
    expect(commit).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })

  it('undo and redo commit what main answers', async () => {
    const { result, commit, lesson } = setup()
    await act(async () => {
      await result.current.apply(moveSlidePlan('s1', 's2'))
      await result.current.undo()
    })
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit.mock.calls[1][0].deck.slides.map((s) => s.id)).toEqual(
      fixtureDeck().slides.map((s) => s.id)
    )
    expect(lesson.future).toHaveLength(1)
    await act(async () => {
      await result.current.redo()
    })
    expect(commit.mock.calls[2][0].history.canRedo).toBe(false)
  })

  it('says so when undo is refused or the call fails', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.undo()
    })
    expect(await screen.findByText('Nothing to undo')).toBeInTheDocument()
  })

  it('rename calls main and re-reads the lesson; a refusal is told', async () => {
    const { result, refresh } = setup()
    let saved = false
    await act(async () => {
      saved = await result.current.rename('New title')
    })
    expect(saved).toBe(true)
    expect(refresh).toHaveBeenCalled()
    const refused = setup({ renameLesson: () => fail('invalid-input', 'Too long') })
    await act(async () => {
      saved = await refused.result.current.rename('x')
    })
    expect(saved).toBe(false)
    expect(await screen.findByText('Too long')).toBeInTheDocument()
  })
})
