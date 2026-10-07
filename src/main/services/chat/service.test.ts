import { appendFileSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INVALID_OPS, aiFailure, cancelledFailure } from '@shared/ai/errors'
import type { AiService } from '@shared/ai/types'
import type { ChatSendArgs, RegionDraft } from '@shared/contracts/deck-builder-chat'
import { fail, ok } from '@shared/result'
import { LESSON_BUSY } from '../lessons/jobs'
import { makeRig, writeTemp } from '../lessons/testing'
import { ChatService, type ChatPluginBridge, type ChatServiceDeps } from './service'
import { ChatStore } from './store'
import { makeServicesRig, USAGE, type ServicesRig } from './testing'

function service(rig: ServicesRig, over: Partial<ChatServiceDeps> = {}): ChatService {
  return new ChatService({
    lessons: rig.service,
    ai: rig.ai,
    store: rig.store,
    renderer: rig.renderer,
    emit: rig.emit,
    ...over
  })
}

const send = (rig: ServicesRig, over: Partial<ChatSendArgs> = {}): ChatSendArgs => ({
  lessonId: rig.lessonId,
  text: 'hello',
  attachmentIds: [],
  regions: [],
  markup: [],
  selectedSlideId: 's3',
  assetRefs: [],
  ...over
})

async function run(chat: ChatService, args: ChatSendArgs) {
  const started = await chat.send(args)
  if (!started.ok) throw new Error(started.message)
  await chat.whenDone(started.jobId)
  return started
}

const region = (over: Partial<RegionDraft> = {}): RegionDraft => ({
  id: 'r1',
  n: 1,
  slideId: 's3',
  path: [
    [1100, 300],
    [1800, 300],
    [1800, 800],
    [1100, 800]
  ],
  bbox: { x: 1100, y: 300, w: 700, h: 500 },
  targetElementIds: ['s3-photo', 'ghost'],
  ...over
})

describe('a turn that edits the deck', () => {
  it('streams, applies one ChangeSet, stores both messages and ends with chat:done', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    const started = await run(chat, send(rig, { text: 'make it shorter' }))
    expect(started).toMatchObject({ ok: true, jobId: expect.stringMatching(/^job_/) })

    expect(rig.names().at(-1)).toBe('chat:done')
    expect(rig.names()).toEqual(
      expect.arrayContaining(['chat:status', 'chat:changes', 'chat:delta', 'chat:done'])
    )
    const changes = rig.of('chat:changes') as Array<{
      lessonId: string
      changeSet: { id: string; by: string }
    }>
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ lessonId: rig.lessonId, changeSet: { by: 'ai' } })
    const text = (rig.of('chat:delta') as Array<{ text: string }>).map((d) => d.text).join('')
    expect(text).toBe('I’ve made that text shorter.')

    const items = await chat.history(rig.lessonId)
    expect(items.map((i) => [i.role, i.text])).toEqual([
      ['user', 'make it shorter'],
      ['assistant', 'I’ve made that text shorter.']
    ])
    expect(items[1].result).toEqual({
      changeSetId: changes[0].changeSet.id,
      label: 'Slide 3 changed',
      slideIds: ['s3'],
      undone: false
    })
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.history.undoChangeSetId).toBe(changes[0].changeSet.id)
  })

  it('labels removals and added quiz slides', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    await run(chat, send(rig, { text: 'delete slide 2' }))
    await run(chat, send(rig, { text: 'add a quiz' }))
    const labels = (await chat.history(rig.lessonId)).flatMap((i) => i.result?.label ?? [])
    expect(labels).toEqual(['1 slide removed', '1 quiz slide added'])
  })

  it('replies without a ResultChip when nothing was changed', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    await run(chat, send(rig, { text: 'what can you do?' }))
    const [, reply] = await chat.history(rig.lessonId)
    expect(reply.result).toBeUndefined()
    expect(rig.of('chat:changes')).toEqual([])
  })

  it('Undo on the chip works while it is the latest change, then shows Undone and can be redone', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    await run(chat, send(rig, { text: 'delete slide 2' }))
    await run(chat, send(rig, { text: 'add a quiz' }))
    const [first, second] = (await chat.history(rig.lessonId)).flatMap((i) => i.result ?? [])

    expect(await chat.undoChange(rig.lessonId, first.changeSetId)).toMatchObject({
      ok: false,
      message: 'Undo the later changes first.'
    })
    const undone = await chat.undoChange(rig.lessonId, second.changeSetId)
    expect(undone).toMatchObject({ ok: true })
    expect(undone.ok && undone.deck.slides).toHaveLength(2)
    expect((await chat.history(rig.lessonId)).flatMap((i) => i.result?.undone ?? [])).toEqual([
      false,
      true
    ])
    const redone = await chat.redoChange(rig.lessonId, second.changeSetId)
    expect(redone.ok && redone.deck.slides).toHaveLength(3)
  })
})

describe('what Claude is given', () => {
  function capturing(rig: ServicesRig) {
    const inputs: Parameters<AiService['chatTurn']>[0][] = []
    const ai: Partial<AiService> = {
      chatTurn: async (input) => {
        inputs.push(input)
        return ok({
          usage: USAGE,
          apiBlocks: [
            { role: 'user', content: [{ type: 'text', text: input.text }] },
            { role: 'assistant', content: [{ type: 'thinking', thinking: 't', signature: 'sig' }] }
          ]
        })
      }
    }
    return { inputs, chat: service(rig, { ai: { ...rig.ai, ...ai } }) }
  }

  it('the outline, the selected slide and the style', async () => {
    const rig = await makeServicesRig()
    const { chat, inputs } = capturing(rig)
    await run(chat, send(rig, { selectedSlideId: 's2' }))
    const input = inputs[0]
    expect(input).toMatchObject({
      lessonId: rig.lessonId,
      text: 'hello',
      selectedSlideJson: { id: 's2' },
      profile: { id: 'sty_science_ks3' },
      deckOutline: { slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }
    })
    expect(input.regions).toBeUndefined()
    expect(input.effort).toBeUndefined()
  })

  it('earlier turns replayed verbatim, thinking blocks included', async () => {
    const rig = await makeServicesRig()
    const { chat, inputs } = capturing(rig)
    await run(chat, send(rig, { text: 'one' }))
    await run(chat, send(rig, { text: 'two' }))
    expect(inputs[0].history).toEqual([])
    expect(inputs[1].history).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'one' }] },
      { role: 'assistant', content: [{ type: 'thinking', thinking: 't', signature: 'sig' }] }
    ])
    const lines = readFileSync(rig.service.chatPath(rig.lessonId), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(4)
    expect(JSON.parse(lines[1])).toMatchObject({ role: 'assistant', usage: USAGE })
  })

  it('more effort for "redo the whole lesson"', async () => {
    const rig = await makeServicesRig()
    const { chat, inputs } = capturing(rig)
    await run(chat, send(rig, { text: 'Please redo the whole lesson for Year 9' }))
    expect(inputs[0].effort).toBe('high')
  })

  it('readSlides and viewSlide serve the live deck', async () => {
    const rig = await makeServicesRig()
    let seen: { slides: unknown; png: Uint8Array; error: unknown } | undefined
    const ai: Partial<AiService> = {
      chatTurn: async (input) => {
        const applied = await input.applyOps('Delete 2', [{ op: 'deleteSlides', slideIds: ['s2'] }])
        const slides = input.readSlides(['s1', 's2'])
        const png = await input.viewSlide('s3')
        const error = await input.viewSlide('s2').catch((e: Error) => e.message)
        seen = { slides, png, error }
        return applied.ok ? ok({ usage: USAGE, apiBlocks: [] }) : fail('unknown', 'x')
      }
    }
    await run(service(rig, { ai: { ...rig.ai, ...ai } }), send(rig))
    expect((seen?.slides as Array<{ id: string }>).map((s) => s.id)).toEqual(['s1'])
    expect(seen?.png.byteLength).toBeGreaterThan(0)
    expect(seen?.error).toBe('There is no slide "s2".')
    const view = rig.renderer.calls.at(-1)
    expect(view).toMatchObject({ width: 1280, height: 720, slide: { id: 's3' } })
  })

  it('applyOps reports invalid ops as errors and leaves the deck unchanged', async () => {
    const rig = await makeServicesRig()
    let outcome: unknown
    const ai: Partial<AiService> = {
      chatTurn: async (input) => {
        outcome = await input.applyOps('Bad', [{ op: 'deleteSlides', slideIds: ['nope'] }])
        return fail('invalid-input', INVALID_OPS)
      }
    }
    await run(service(rig, { ai: { ...rig.ai, ...ai } }), send(rig))
    expect(outcome).toMatchObject({ ok: false, errors: [expect.stringContaining('nope')] })
    expect(rig.of('chat:changes')).toEqual([])
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.deck.slides).toHaveLength(3)
  })
})

describe('circle to edit', () => {
  it('renders the annotated slide (1280x720) and a 2x close-up, and keeps the region with the message', async () => {
    const rig = await makeServicesRig()
    const inputs: Parameters<AiService['chatTurn']>[0][] = []
    const ai: Partial<AiService> = {
      chatTurn: async (input) => (inputs.push(input), ok({ usage: USAGE, apiBlocks: [] }))
    }
    const chat = service(rig, { ai: { ...rig.ai, ...ai } })
    rig.renderer.calls.length = 0
    await run(
      chat,
      send(rig, {
        text: 'Swap this photo for a labelled diagram of a leaf please',
        regions: [region()],
        markup: [
          {
            slideId: 's3',
            strokes: [
              [
                [0, 0],
                [10, 10]
              ]
            ]
          }
        ]
      })
    )
    const [full, crop] = rig.renderer.calls
    expect(full).toMatchObject({
      width: 1280,
      height: 720,
      marks: [{ n: 1 }],
      strokes: [
        [
          [0, 0],
          [10, 10]
        ]
      ]
    })
    expect(crop.crop).toMatchObject({ x: expect.any(Number), w: expect.any(Number) })
    expect(crop.width).toBe(Math.round(crop.crop!.w * (1280 / 1920) * 2))

    expect(inputs[0].regions).toHaveLength(1)
    expect(inputs[0].regions?.[0]).toMatchObject({
      n: 1,
      slideId: 's3',
      slideNumber: 3,
      targetElementIds: ['s3-photo']
    })
    const [user] = await chat.history(rig.lessonId)
    expect(user.regions).toEqual([
      expect.objectContaining({
        n: 1,
        slideId: 's3',
        slideNumber: 3,
        caption: 'Swap this photo for a…'
      })
    ])
  })

  it('words marks on slides without a region', async () => {
    const rig = await makeServicesRig()
    const inputs: Parameters<AiService['chatTurn']>[0][] = []
    const ai: Partial<AiService> = {
      chatTurn: async (input) => (inputs.push(input), ok({ usage: USAGE, apiBlocks: [] }))
    }
    await run(
      service(rig, { ai: { ...rig.ai, ...ai } }),
      send(rig, {
        markup: [
          {
            slideId: 's2',
            strokes: [
              [
                [0, 0],
                [5, 5]
              ]
            ]
          }
        ]
      })
    )
    expect(inputs[0].text).toContain('also drew marks on slide 2')
    expect(inputs[0].regions).toBeUndefined()
  })

  it('drops regions on slides that no longer exist', async () => {
    const rig = await makeServicesRig()
    const inputs: Parameters<AiService['chatTurn']>[0][] = []
    const ai: Partial<AiService> = {
      chatTurn: async (input) => (inputs.push(input), ok({ usage: USAGE, apiBlocks: [] }))
    }
    await run(
      service(rig, { ai: { ...rig.ai, ...ai } }),
      send(rig, { regions: [region({ slideId: 'gone' })] })
    )
    expect(inputs[0].regions).toBeUndefined()
  })

  it('fails the turn clearly when a picture cannot be drawn', async () => {
    const rig = await makeServicesRig()
    rig.renderer.failWith = new Error('GPU lost')
    await run(service(rig), send(rig, { regions: [region()] }))
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({
        scope: 'chat',
        message: 'I couldn’t look at the circled area. Try again.'
      })
    ])
    expect(rig.of('chat:changes')).toEqual([])
  })

  it('refuses more than 9 regions', async () => {
    const rig = await makeServicesRig()
    const regions = Array.from({ length: 10 }, (_, i) => region({ id: `r${i}`, n: i + 1 }))
    expect(await service(rig).send(send(rig, { regions }))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
  })
})

describe('stopping and failing', () => {
  /** Like the real layer: answers "cancelled" as soon as the signal is (or becomes) aborted. */
  const waitForAbort: Partial<AiService> = {
    chatTurn: (_input, _sink, opts) =>
      new Promise((resolve) => {
        if (opts?.signal?.aborted) return resolve(cancelledFailure())
        opts?.signal?.addEventListener('abort', () => resolve(cancelledFailure()))
      })
  }

  it('Stop leaves the deck unchanged, stores "Stopped." and still ends the turn', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig, { ai: { ...rig.ai, ...waitForAbort } })
    const started = await chat.send(send(rig))
    if (!started.ok) throw new Error('send failed')
    chat.cancel(started.jobId)
    await chat.whenDone(started.jobId)
    const [, stopped] = await chat.history(rig.lessonId)
    expect(stopped.error).toEqual({ code: 'cancelled', message: 'Stopped. Nothing was changed.' })
    expect(rig.names()).toContain('chat:done')
    expect(rig.names()).not.toContain('ai:error')
    expect((await rig.service.open(rig.lessonId)).ok).toBe(true)
  })

  it('Stop after a change was applied says the change was kept and keeps its chip', async () => {
    const rig = await makeServicesRig()
    const ai: Partial<AiService> = {
      chatTurn: async (input, _sink, opts) => {
        await input.applyOps('Delete 2', [{ op: 'deleteSlides', slideIds: ['s2'] }])
        return new Promise((resolve) =>
          opts?.signal?.addEventListener('abort', () => resolve(cancelledFailure()))
        )
      }
    }
    const chat = service(rig, { ai: { ...rig.ai, ...ai } })
    const started = await chat.send(send(rig))
    if (!started.ok) throw new Error('send failed')
    while (rig.of('chat:changes').length === 0) await new Promise((r) => setTimeout(r, 1))
    chat.cancel(started.jobId)
    await chat.whenDone(started.jobId)
    const [, stopped] = await chat.history(rig.lessonId)
    expect(stopped.error?.message).toBe('Stopped. The changes already made were kept.')
    expect(stopped.result?.label).toBe('1 slide removed')
  })

  it.each([
    ['no-key', 'settings', false],
    ['no-credit', 'console', false],
    ['network', 'retry', true],
    ['overloaded', 'retry', true],
    ['refused', undefined, false]
  ] as const)('%s becomes ai:error with action %s', async (code, action, retryable) => {
    const rig = await makeServicesRig({ fake: { failWith: code } })
    const chat = service(rig)
    await run(chat, send(rig))
    const errors = rig.of('ai:error') as Array<Record<string, unknown>>
    expect(errors).toEqual([expect.objectContaining({ scope: 'chat', code, retryable })])
    expect(errors[0].message).toBe(aiFailure(code).message)
    const [, reply] = await chat.history(rig.lessonId)
    expect(reply.error?.action).toBe(action)
    expect(rig.names()).not.toContain('chat:done')
  })

  it('an exception inside the AI layer becomes a friendly error, not a crash', async () => {
    const rig = await makeServicesRig()
    const ai: Partial<AiService> = {
      chatTurn: async () => {
        throw new Error('socket hang up')
      }
    }
    await run(service(rig, { ai: { ...rig.ai, ...ai } }), send(rig))
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ code: 'unknown', message: 'socket hang up', retryable: true })
    ])
  })

  it('invalid ops twice end as a retryable error that says nothing changed', async () => {
    const rig = await makeServicesRig()
    const ai: Partial<AiService> = { chatTurn: async () => fail('invalid-input', INVALID_OPS) }
    const chat = service(rig, { ai: { ...rig.ai, ...ai } })
    await run(chat, send(rig))
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ code: 'unknown', message: INVALID_OPS, retryable: true })
    ])
    expect((await chat.history(rig.lessonId))[1].error).toMatchObject({ action: 'retry' })
  })

  it('keeps the text streamed before a failure', async () => {
    const rig = await makeServicesRig()
    const ai: Partial<AiService> = {
      chatTurn: async (_input, sink) => {
        sink.delta('Working on it… ')
        return aiFailure('network')
      }
    }
    const chat = service(rig, { ai: { ...rig.ai, ...ai } })
    await run(chat, send(rig))
    expect((await chat.history(rig.lessonId))[1].text).toBe('Working on it… ')
  })
})

describe('sending', () => {
  it('allows one job per lesson', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig, {
      ai: { ...rig.ai, ...{ chatTurn: () => new Promise(() => undefined) } }
    })
    const first = await chat.send(send(rig))
    expect(first.ok).toBe(true)
    expect(await chat.send(send(rig))).toMatchObject({ ok: false, message: LESSON_BUSY })
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.runningJob).toMatchObject({ kind: 'chat' })
  })

  it('validates the message before starting anything', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    expect(await chat.send(send(rig, { text: '   ' }))).toMatchObject({
      ok: false,
      code: 'invalid-input'
    })
    expect(await chat.send(send(rig, { lessonId: 'les_nope' }))).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await chat.send(send(rig, { attachmentIds: ['a', 'b', 'c', 'd'] }))).toMatchObject({
      ok: false,
      message: 'You can attach up to 3 files.'
    })
    expect(rig.service.jobs.running(rig.lessonId)).toBeUndefined()
  })

  it('accepts a message that is only an attachment, and shows the attachment in history', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    const attached = await chat.attachPath(rig.lessonId, await writeTemp('worksheet.docx', 'doc'))
    if (!attached.ok) throw new Error(attached.message)
    await run(chat, send(rig, { text: '', attachmentIds: [attached.attachment.id, 'ast_unknown'] }))
    const [user] = await chat.history(rig.lessonId)
    expect(user.attachments).toEqual([attached.attachment])
  })

  it('attach uses the Open dialog and reports a cancel', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    expect(await chat.attach(rig.lessonId)).toEqual({ ok: true, cancelled: true })
    rig.dialogs.openPath = await writeTemp('pic.png')
    expect(await chat.attach(rig.lessonId)).toMatchObject({
      ok: true,
      attachment: { kind: 'image' }
    })
  })

  it('works through the plugin bridge only when one is configured', async () => {
    const rig = await makeServicesRig()
    const seen: Array<{ plugins: Parameters<AiService['chatTurn']>[0]['plugins'] }> = []
    const ai: Partial<AiService> = {
      chatTurn: async (input) => {
        seen.push({ plugins: input.plugins })
        await input.plugins?.run('quiz', { count: 5 })
        return ok({ usage: USAGE, apiBlocks: [] })
      }
    }
    const calls: unknown[] = []
    const bridge: ChatPluginBridge = {
      list: () => ['quiz'],
      run: async (args) => (calls.push(args), 'Made 5 questions')
    }
    await run(service(rig, { ai: { ...rig.ai, ...ai } }), send(rig))
    await run(service(rig, { ai: { ...rig.ai, ...ai }, plugins: bridge }), send(rig))
    expect(seen[0].plugins).toBeUndefined()
    expect(seen[1].plugins?.list()).toEqual(['quiz'])
    expect(calls).toEqual([
      expect.objectContaining({
        lessonId: rig.lessonId,
        pluginId: 'quiz',
        inputs: { count: 5 },
        currentSlideId: 's3'
      })
    ])
  })
})

describe('history', () => {
  it('skips damaged lines and survives a missing file', async () => {
    const rig = await makeServicesRig()
    const chat = service(rig)
    expect(await chat.history(rig.lessonId)).toEqual([])
    await run(chat, send(rig, { text: 'hi' }))
    appendFileSync(rig.service.chatPath(rig.lessonId), '{"id": "half-written\n{"id":1}\n')
    expect((await chat.history(rig.lessonId)).map((i) => i.text)).toEqual([
      'hi',
      expect.any(String)
    ])
  })

  it('restores after a restart, with the chip still undoable', async () => {
    const rig = await makeServicesRig()
    await run(service(rig), send(rig, { text: 'delete slide 1' }))
    const restarted = makeRig({ dir: rig.dir })
    const chat = service(rig, {
      lessons: restarted.service,
      store: new ChatStore((id) => restarted.service.chatPath(id))
    })
    const items = await chat.history(rig.lessonId)
    expect(items[1].result).toMatchObject({ label: '1 slide removed', undone: false })
    const undone = await chat.undoChange(rig.lessonId, items[1].result?.changeSetId ?? '')
    expect(undone.ok && undone.deck.slides).toHaveLength(3)
  })
})
