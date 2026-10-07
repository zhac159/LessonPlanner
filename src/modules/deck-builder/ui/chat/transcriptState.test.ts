import { describe, expect, it } from 'vitest'
import { STOPPED } from '@shared/ai/errors'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import {
  initialTranscript,
  liveTurn,
  runningStep,
  transcriptEntries,
  transcriptReducer,
  upsertStep,
  type TranscriptAction,
  type TranscriptState
} from './transcriptState'

const item = (id: string, role: ChatItem['role'] = 'assistant', text = ''): ChatItem => ({
  id,
  role,
  at: '2026-10-06T09:00:00.000Z',
  text
})

const run = (state: TranscriptState, ...actions: TranscriptAction[]): TranscriptState =>
  actions.reduce(transcriptReducer, state)

const ids = (state: TranscriptState): string[] =>
  transcriptEntries(state).map((e) =>
    e.kind === 'message' ? e.item.id : e.kind === 'request' ? e.request.id : e.id
  )

describe('upsertStep', () => {
  it('adds a step and settles the one that was running', () => {
    const steps = upsertStep(
      upsertStep([], 'Reading the circled area', 'running'),
      'Drawing',
      'running'
    )
    expect(steps).toEqual([
      { label: 'Reading the circled area', state: 'done' },
      { label: 'Drawing', state: 'running' }
    ])
  })

  it('updates a step it already knows instead of repeating it', () => {
    const steps = upsertStep([{ label: 'Drawing', state: 'running' }], 'Drawing', 'done')
    expect(steps).toEqual([{ label: 'Drawing', state: 'done' }])
  })

  it('finds the step under way', () => {
    expect(runningStep([{ label: 'a', state: 'done' }])).toBeUndefined()
    expect(runningStep(upsertStep([], 'b', 'running'))?.label).toBe('b')
  })
})

describe('streaming a turn', () => {
  const started = run(
    initialTranscript([item('m1', 'user', 'Hi')], null),
    { type: 'start', turn: { kind: 'chat' } },
    { type: 'job-started', jobId: 'job_1', messageId: 'm2' }
  )

  it('collects text and steps for the turn that is showing', () => {
    const state = run(
      started,
      { type: 'status', messageId: 'm2', step: 'Reading', state: 'running' },
      { type: 'delta', messageId: 'm2', text: 'Done! ' },
      { type: 'delta', messageId: 'm2', text: '8 slides.' }
    )
    expect(state.live).toMatchObject({ jobId: 'job_1', messageId: 'm2', text: 'Done! 8 slides.' })
    expect(state.live?.steps).toEqual([{ label: 'Reading', state: 'running' }])
  })

  it('ignores events for another message once the turn is known', () => {
    const state = run(started, { type: 'delta', messageId: 'other', text: 'x' })
    expect(state.live?.text).toBe('')
  })

  it('adopts the message id of an event that arrives before the start call answers', () => {
    const early = run(
      initialTranscript([], null),
      { type: 'start', turn: { kind: 'chat' } },
      { type: 'delta', messageId: 'm9', text: 'Hi' },
      { type: 'job-started', jobId: 'job_9', messageId: 'm9' }
    )
    expect(early.live).toMatchObject({ jobId: 'job_9', messageId: 'm9', text: 'Hi' })
  })

  it('keeps what a job sent when it is announced after its first events', () => {
    const state = run(
      initialTranscript([], null),
      { type: 'start', turn: { kind: 'chat' } },
      { type: 'status', messageId: 'm1', step: 'Reading', state: 'running' },
      { type: 'start', turn: { kind: 'plugin', pluginId: 'quiz' } }
    )
    expect(state.live).toMatchObject({ kind: 'plugin', pluginId: 'quiz' })
    expect(state.live?.steps).toHaveLength(1)
  })

  it('ignores progress events when nothing is running', () => {
    const idle = initialTranscript([], null)
    expect(run(idle, { type: 'delta', messageId: 'm', text: 'x' })).toBe(idle)
    expect(run(idle, { type: 'changed' })).toBe(idle)
    expect(run(idle, { type: 'stopping' })).toBe(idle)
  })

  it('records generation progress with its step', () => {
    const state = run(
      initialTranscript([], liveTurn({ kind: 'generation', jobId: 'j', messageId: 'm' })),
      {
        type: 'progress',
        value: 2,
        max: 8,
        label: 'Writing slide 3 of 8…',
        step: 'Writing the slides…'
      }
    )
    expect(state.live?.progress).toEqual({ value: 2, max: 8, label: 'Writing slide 3 of 8…' })
    expect(state.live?.steps).toEqual([{ label: 'Writing the slides…', state: 'running' }])
  })

  it('finishes into a message and leaves no live turn', () => {
    const state = run(
      started,
      { type: 'delta', messageId: 'm2', text: 'All done.' },
      { type: 'file', file: { name: 'quiz.docx', path: 'C:/q.docx', kind: 'docx' } },
      { type: 'finish', at: '2026-10-06T10:00:00.000Z' }
    )
    expect(state.live).toBeNull()
    const last = transcriptEntries(state).at(-1)
    expect(last).toMatchObject({
      kind: 'message',
      item: { id: 'm2', role: 'assistant', text: 'All done.', file: { name: 'quiz.docx' } }
    })
  })

  it('turns a stop with no output into the calm "Stopped" note', () => {
    const state = run(started, { type: 'stopping' }, { type: 'finish', at: 'now' })
    expect(transcriptEntries(state).at(-1)).toMatchObject({ item: { text: STOPPED } })
  })

  it('keeps an error on the finished message', () => {
    const error = {
      code: 'network' as const,
      message: 'Can’t reach Claude.',
      action: 'retry' as const
    }
    const state = run(started, { type: 'finish', error, at: 'now' })
    expect(transcriptEntries(state).at(-1)).toMatchObject({ item: { error } })
  })
})

describe('local entries and syncing', () => {
  const echo = item('local:user-1', 'user', 'Make it bigger')

  it('puts local entries after the last stored message', () => {
    const state = run(initialTranscript([item('m1'), item('m2')], null), {
      type: 'add-local',
      entry: { kind: 'message', item: echo }
    })
    expect(ids(state)).toEqual(['m1', 'm2', 'local:user-1'])
  })

  it('replaces local messages with the stored copy once the turn is over', () => {
    let state = run(initialTranscript([item('m1')], null), {
      type: 'add-local',
      entry: { kind: 'message', item: echo }
    })
    state = run(state, { type: 'synced', items: [item('m1'), item('m2', 'user'), item('m3')] })
    expect(ids(state)).toEqual(['m1', 'm2', 'm3'])
  })

  it('keeps her optimistic message while a turn is still running', () => {
    let state = run(initialTranscript([item('m1')], null), {
      type: 'add-local',
      entry: { kind: 'message', item: echo }
    })
    state = run(state, { type: 'start', turn: { kind: 'chat' } })
    state = run(state, { type: 'synced', items: [item('m1')] })
    expect(ids(state)).toEqual(['m1', 'local:user-1'])
  })

  it('keeps a plugin request in front of the reply it caused', () => {
    const request = {
      id: 'local:request-1',
      pluginId: 'quiz',
      title: 'Quiz from slides',
      icon: 'list-checks',
      tint: 'peach' as const,
      summary: '10 questions'
    }
    let state = run(initialTranscript([item('m1')], null), {
      type: 'add-local',
      entry: { kind: 'request', request }
    })
    state = run(state, { type: 'synced', items: [item('m1'), item('m2')] })
    expect(ids(state)).toEqual(['m1', 'local:request-1', 'm2'])
  })

  it('shows one Connect Claude prompt and drops it when a send starts', () => {
    let state = run(initialTranscript([], null), {
      type: 'add-local',
      entry: { kind: 'key-prompt', id: 'key-prompt' }
    })
    expect(ids(state)).toEqual(['key-prompt'])
    state = run(state, { type: 'start', turn: { kind: 'chat' } })
    expect(ids(state)).toEqual([])
  })

  it('removes a local entry by id', () => {
    const state = run(
      initialTranscript([], null),
      { type: 'add-local', entry: { kind: 'message', item: echo } },
      { type: 'remove-local', id: 'local:user-1' }
    )
    expect(ids(state)).toEqual([])
  })

  it('does not show a local copy of a message main already stored', () => {
    const state = run(initialTranscript([item('m2')], null), {
      type: 'add-local',
      entry: { kind: 'message', item: item('m2', 'assistant', 'local copy') }
    })
    expect(ids(state)).toEqual(['m2'])
  })

  it('resets for another lesson', () => {
    const state = run(initialTranscript([item('m1')], liveTurn({ kind: 'chat' })), {
      type: 'reset',
      items: [item('x')],
      live: null
    })
    expect(ids(state)).toEqual(['x'])
    expect(state.live).toBeNull()
  })
})

describe('Undo state on result chips', () => {
  const withResult: ChatItem = {
    ...item('m2'),
    result: { changeSetId: 'cs1', label: '8 slides added', slideIds: ['s1'], undone: false }
  }

  it('marks the chip undone and back', () => {
    let state = initialTranscript([withResult], null)
    state = run(state, { type: 'set-undone', changeSetId: 'cs1', undone: true })
    expect(state.server[0].result?.undone).toBe(true)
    state = run(state, { type: 'set-undone', changeSetId: 'cs1', undone: false })
    expect(state.server[0].result?.undone).toBe(false)
  })

  it('leaves other changes alone', () => {
    const state = run(initialTranscript([withResult], null), {
      type: 'set-undone',
      changeSetId: 'other',
      undone: true
    })
    expect(state.server[0].result?.undone).toBe(false)
  })
})
