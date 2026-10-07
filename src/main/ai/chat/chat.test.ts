/** The editor chat tool loop against a scripted SDK stub: request shape, tools, retries, replay, cancellation. */
import { describe, expect, it, vi } from 'vitest'
import { INVALID_OPS } from '@shared/ai/errors'
import type { ApiMessage, ChatSink } from '@shared/ai/types'
import { defaultDeps, type CallDeps } from '../calls/deps'
import { fixtureProfile } from '../fake/fixtures'
import {
  createRig,
  message,
  textMessage,
  toolUse,
  toolUseMessage,
  type StubReply
} from '../testing'
import { chatTurn } from './loop'

type Input = Parameters<typeof chatTurn>[1]

const setup = (script: StubReply[], over: Partial<Input> = {}) => {
  const rig = createRig(script)
  const deps: CallDeps = { ...defaultDeps(rig.runner), now: () => new Date('2026-10-06T10:00:00Z') }
  const events: string[] = []
  const sink: ChatSink = {
    delta: (t) => events.push(`delta:${t}`),
    status: (s, state) => events.push(`status:${s}:${state}`),
    changes: (c) => events.push(`changes:${c.id}:${c.summary}`)
  }
  const applyOps = vi.fn(async () => ({ ok: true as const, changeSetId: 'cs_1' }))
  const input: Input = {
    lessonId: 'l1',
    messageId: 'm1',
    text: 'Make slide 2 shorter',
    profile: fixtureProfile(),
    deckOutline: { slides: [{ id: 's1' }, { id: 's2' }] },
    history: [],
    applyOps,
    readSlides: vi.fn((ids: string[]) => ids.map((id) => ({ id, elements: [] }))),
    viewSlide: vi.fn(async () => new Uint8Array([137, 80, 78, 71])),
    ...over
  }
  return { rig, deps, sink, events, input, applyOps }
}

const ops = [{ op: 'deleteSlides', slideIds: ['s2'] }]
const applyCall = (id = 'tu_1') =>
  toolUseMessage([toolUse(id, 'apply_changes', { summary: 'Deleted slide 2', ops })])

describe('request layout', () => {
  it('sends stable -> volatile with breakpoints, auto tools, adaptive thinking and no prefill', async () => {
    const { rig, deps, sink, input } = setup([textMessage('Hello there')])
    await chatTurn(deps, input, sink)
    const request = rig.stub.requests[0]
    const system = request.system as Array<{ text: string; cache_control?: unknown }>
    expect(system).toHaveLength(2)
    expect(system[0].text).toContain('planning buddy')
    expect(system[0].text).toContain('# Deck model')
    expect(system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(system[1].text).toContain('Style profile')
    expect(system[1].cache_control).toEqual({ type: 'ephemeral' })
    expect(request.thinking).toEqual({ type: 'adaptive' })
    expect(request.output_config).toEqual({ effort: 'medium' })
    expect(request.tool_choice).toEqual({ type: 'auto' })
    expect(rig.stub.streamed).toEqual([true])
    const tools = request.tools as Array<{
      name: string
      strict?: boolean
      eager_input_streaming?: boolean
    }>
    expect(tools.map((t) => t.name)).toEqual(['read_slides', 'view_slide', 'apply_changes'])
    expect(tools.find((t) => t.name === 'read_slides')?.strict).toBe(true)
    expect(tools.every((t) => t.eager_input_streaming)).toBe(true)
    expect(request.messages.at(-1)?.role).toBe('user')
    const last = request.messages.at(-1)?.content as Array<{
      text: string
      cache_control?: unknown
    }>
    expect(last.at(-1)).toMatchObject({
      text: 'Make slide 2 shorter',
      cache_control: { type: 'ephemeral' }
    })
  })

  it('puts the deck snapshot before the teacher’s words and honours an effort override', async () => {
    const { rig, deps, sink, input } = setup([textMessage('ok')], {
      selectedSlideJson: { id: 's2' },
      effort: 'high'
    })
    await chatTurn(deps, input, sink)
    const content = rig.stub.requests[0].messages[0].content as Array<{ text: string }>
    expect(content[0].text).toContain('Deck outline')
    expect(content[1].text).toContain('Selected slide')
    expect(content.at(-1)?.text).toBe('Make slide 2 shorter')
    expect(rig.stub.requests[0].output_config?.effort).toBe('high')
  })

  it('offers the plugin tools only when a plugin bridge is given', async () => {
    const plugins = { list: vi.fn(() => [{ id: 'quiz' }]), run: vi.fn(async () => ({ made: 1 })) }
    const { rig, deps, sink, input } = setup([textMessage('ok')], { plugins })
    await chatTurn(deps, input, sink)
    const names = (rig.stub.requests[0].tools as Array<{ name: string }>).map((t) => t.name)
    expect(names).toEqual([
      'read_slides',
      'view_slide',
      'apply_changes',
      'run_plugin',
      'list_plugins'
    ])
  })

  it('attaches circled regions as images plus their element ids, and the slide JSON', async () => {
    const png = new Uint8Array([1, 2, 3])
    const regions = [
      {
        n: 1,
        slideId: 's3',
        slideNumber: 3,
        annotatedPng: png,
        cropPng: png,
        targetElementIds: ['e3-photo'],
        bbox: { x: 1075.4, y: 300, w: 790, h: 550 }
      }
    ]
    const { rig, deps, sink, input } = setup([textMessage('ok')], {
      regions,
      attachments: [{ name: 'notes.docx', kind: 'docx' }]
    })
    await chatTurn(deps, input, sink)
    const content = rig.stub.requests[0].messages[0].content as Array<{
      type: string
      text?: string
    }>
    expect(content.map((b) => b.type)).toEqual([
      'text',
      'text',
      'image',
      'image',
      'text',
      'text',
      'text'
    ])
    expect(content[1].text).toContain('"id":"s3"')
    expect(content[4].text).toContain('Region 1 on slide 3 (id s3) targets elements: e3-photo')
    expect(content[4].text).toContain('x 1075, y 300, w 790, h 550')
    expect(content[5].text).toContain('notes.docx (docx)')
  })
})

describe('tool loop', () => {
  it('streams text, runs apply_changes, reports steps and the ChangeSet, then answers', async () => {
    const { rig, deps, sink, events, input, applyOps } = setup([
      applyCall(),
      textMessage('Done, I deleted it.', { usage: { input: 5, output: 7 } })
    ])
    const result = await chatTurn(deps, input, sink)
    expect(applyOps).toHaveBeenCalledWith('Deleted slide 2', ops)
    expect(events).toContain('status:Making the changes:running')
    expect(events).toContain('status:Making the changes:done')
    expect(events).toContain('changes:cs_1:Deleted slide 2')
    expect(
      events
        .filter((e) => e.startsWith('delta:'))
        .map((e) => e.slice(6))
        .join('')
    ).toBe('Done, I deleted it.')
    const second = rig.stub.requests[1].messages
    expect(second.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    const toolResult = (
      second[2].content as Array<{ type: string; tool_use_id: string; content: string }>
    )[0]
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 'tu_1' })
    expect(JSON.parse(toolResult.content)).toEqual({ changeSetId: 'cs_1', ok: true })
    expect(result.apiBlocks.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(result.usage.outputTokens).toBe(5 + 7)
    expect(rig.usage.map((u) => u.task)).toEqual(['chatTurn', 'chatTurn'])
  })

  it('retries an invalid apply_changes once, showing the model the errors', async () => {
    const { rig, deps, sink, input, applyOps } = setup([
      applyCall('a'),
      applyCall('b'),
      textMessage('Fixed.')
    ])
    applyOps.mockResolvedValueOnce({ ok: false, errors: ['unknown slide s9'] } as never)
    const result = await chatTurn(deps, input, sink)
    expect(applyOps).toHaveBeenCalledTimes(2)
    const firstResult = (
      rig.stub.requests[1].messages[2].content as Array<{ content: string; is_error?: boolean }>
    )[0]
    expect(firstResult.is_error).toBe(true)
    expect(firstResult.content).toContain('unknown slide s9')
    expect(result.apiBlocks).toHaveLength(6)
  })

  it('ends the turn after two invalid attempts in a row', async () => {
    const { deps, sink, input, applyOps } = setup([
      applyCall('a'),
      applyCall('b'),
      textMessage('never reached')
    ])
    applyOps.mockResolvedValue({ ok: false, errors: ['bad'] } as never)
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'invalid-input', message: INVALID_OPS }
    })
    expect(applyOps).toHaveBeenCalledTimes(2)
  })

  it('counts invalid tool input (not only invalid ops) as a rejected attempt', async () => {
    const bad = toolUseMessage([toolUse('x', 'apply_changes', { summary: 'no ops' })])
    const { deps, sink, input, applyOps } = setup([bad, bad])
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
    expect(applyOps).not.toHaveBeenCalled()
  })

  it('a success in between resets the rejection count', async () => {
    const { deps, sink, input, applyOps } = setup([
      applyCall('a'),
      applyCall('b'),
      applyCall('c'),
      textMessage('ok')
    ])
    applyOps
      .mockResolvedValueOnce({ ok: false, errors: ['x'] } as never)
      .mockResolvedValueOnce({ ok: true, changeSetId: 'cs_2' })
      .mockResolvedValueOnce({ ok: false, errors: ['y'] } as never)
    await expect(chatTurn(deps, input, sink)).resolves.toBeDefined()
  })

  it('answers read_slides with stable JSON and view_slide with an image block', async () => {
    const script = [
      toolUseMessage([
        toolUse('r', 'read_slides', { slideIds: ['s1'] }),
        toolUse('v', 'view_slide', { slideId: 's1' })
      ]),
      textMessage('Looks fine.')
    ]
    const { rig, deps, sink, events, input } = setup(script)
    await chatTurn(deps, input, sink)
    const results = rig.stub.requests[1].messages[2].content as Array<{
      tool_use_id: string
      content: unknown
    }>
    expect(results.map((r) => r.tool_use_id)).toEqual(['r', 'v'])
    expect(results[0].content).toBe('[{"elements":[],"id":"s1"}]')
    expect(JSON.stringify(results[1].content)).toContain('"type":"image"')
    expect(events).toContain('status:Reading the slides:done')
    expect(events).toContain('status:Checking how it looks:done')
  })

  it('runs plugins through the bridge and lists them', async () => {
    const plugins = { list: vi.fn(() => [{ id: 'quiz' }]), run: vi.fn(async () => ({ slides: 3 })) }
    const script = [
      toolUseMessage([
        toolUse('l', 'list_plugins', {}),
        toolUse('p', 'run_plugin', { pluginId: 'quiz', inputs: { n: 3 } })
      ]),
      textMessage('Made a quiz.')
    ]
    const { rig, deps, sink, input } = setup(script, { plugins })
    await chatTurn(deps, input, sink)
    expect(plugins.run).toHaveBeenCalledWith('quiz', { n: 3 })
    const results = rig.stub.requests[1].messages[2].content as Array<{ content: string }>
    expect(results[0].content).toBe('[{"id":"quiz"}]')
    expect(results[1].content).toBe('{"slides":3}')
  })

  it('turns a throwing tool or an unknown tool into an error result the model can read', async () => {
    const script = [
      toolUseMessage([
        toolUse('a', 'read_slides', { slideIds: ['s1'] }),
        toolUse('b', 'teleport', {}),
        toolUse('c', 'run_plugin', { pluginId: 'q', inputs: {} })
      ]),
      textMessage('Sorry.')
    ]
    const { rig, deps, sink, events, input } = setup(script, {
      readSlides: () => {
        throw new Error('deck is locked')
      }
    })
    await expect(chatTurn(deps, input, sink)).resolves.toBeDefined()
    const results = rig.stub.requests[1].messages[2].content as Array<{
      content: string
      is_error?: boolean
    }>
    expect(results[0]).toMatchObject({ is_error: true, content: 'Tool failed: deck is locked' })
    expect(results[1]).toMatchObject({ is_error: true, content: 'Unknown tool: teleport' })
    expect(results[2].is_error).toBe(true)
    expect(events).toContain('status:Reading the slides:error')
  })

  it('rejects invalid read_slides input', async () => {
    const script = [
      toolUseMessage([toolUse('a', 'read_slides', { slideIds: 'nope' })]),
      textMessage('ok')
    ]
    const { rig, deps, sink, input } = setup(script)
    await chatTurn(deps, input, sink)
    const [result] = rig.stub.requests[1].messages[2].content as Array<{
      content: string
      is_error?: boolean
    }>
    expect(result.is_error).toBe(true)
    expect(result.content).toContain('Invalid input')
  })

  it('gives up after too many rounds', async () => {
    const loop = Array.from({ length: 12 }, (_, i) =>
      toolUseMessage([toolUse(`t${i}`, 'read_slides', { slideIds: [] })])
    )
    const { deps, sink, input } = setup(loop)
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
  })

  it('does not run a tool call that was cut off by max_tokens', async () => {
    const cut = toolUseMessage([toolUse('t', 'apply_changes', { summary: 'half' })], {
      stop: 'max_tokens'
    })
    const { deps, sink, input, applyOps } = setup([cut, cut])
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'unknown' }
    })
    expect(applyOps).not.toHaveBeenCalled()
  })

  it('resumes after pause_turn', async () => {
    const { rig, deps, sink, input } = setup([
      message({ content: [{ type: 'text', text: 'thinking…' }], stop: 'pause_turn' }),
      textMessage('Done.')
    ])
    const result = await chatTurn(deps, input, sink)
    expect(rig.stub.requests).toHaveLength(2)
    expect(result.apiBlocks.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant'])
  })

  it('maps a refusal to the refused failure', async () => {
    const { deps, sink, input } = setup([message({ stop: 'refusal' })])
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'refused' }
    })
  })
})

describe('history replay (append-only)', () => {
  const thinking = { type: 'thinking', thinking: '', signature: 'sig-abc' }
  const history: ApiMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'Earlier question' }] },
    { role: 'assistant', content: [thinking, { type: 'text', text: 'Earlier answer' }] }
  ]

  it('replays earlier messages verbatim (thinking blocks included) without touching the stored copy', async () => {
    const snapshot = structuredClone(history)
    const { rig, deps, sink, input } = setup([textMessage('Now this.')], { history })
    const result = await chatTurn(deps, input, sink)
    const sent = rig.stub.requests[0].messages
    expect(sent.slice(0, 2)).toEqual(snapshot)
    expect(history).toEqual(snapshot)
    expect(sent).toHaveLength(3)
    expect(result.apiBlocks).toHaveLength(2)
    expect(JSON.stringify(result.apiBlocks)).not.toContain('cache_control')
  })

  it('keeps the reply’s thinking and tool blocks exactly as received for storage', async () => {
    const reply = toolUseMessage([thinking, toolUse('t', 'read_slides', { slideIds: [] })])
    const { deps, sink, input } = setup([reply, textMessage('ok')])
    const result = await chatTurn(deps, input, sink)
    expect(result.apiBlocks[1].content).toEqual(reply.content)
  })

  it('rejects history that is not in the stored shape', async () => {
    const { deps, sink, input } = setup([], { history: [{ nope: true }] })
    await expect(chatTurn(deps, input, sink)).rejects.toMatchObject({
      failure: { code: 'invalid-input' }
    })
  })
})

describe('cancellation', () => {
  it('stops before the first request when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const { rig, deps, sink, input } = setup([textMessage('x')])
    await expect(chatTurn(deps, input, sink, { signal: controller.signal })).rejects.toMatchObject({
      failure: { code: 'cancelled' }
    })
    expect(rig.stub.requests).toHaveLength(0)
  })

  it('stops between tool rounds without applying anything further', async () => {
    const controller = new AbortController()
    const { deps, sink, input, applyOps } = setup([
      toolUseMessage([toolUse('t', 'read_slides', { slideIds: [] })]),
      applyCall()
    ])
    input.readSlides = () => {
      controller.abort()
      return []
    }
    await expect(chatTurn(deps, input, sink, { signal: controller.signal })).rejects.toMatchObject({
      failure: { code: 'cancelled' }
    })
    expect(applyOps).not.toHaveBeenCalled()
  })
})
