import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { aiFailure } from '@shared/ai/errors'
import type { StructuredRequest } from '@shared/ai/types'
import type { PluginRunContext } from '@shared/contracts/deck-builder-plugins'
import { makeSlide } from '@shared/deck/testing'
import type { PluginContext } from '@shared/plugins/types'
import { PluginError, orThrow } from '@shared/plugins/types'
import { z } from 'zod'
import { LESSON_BUSY } from '../lessons/jobs'
import { PluginRegistry } from './registry'
import { demoPlugin, inlineSources, makePluginRig, type PluginRig } from './testing'

const noop = async () => undefined
const context = (over: Partial<PluginRunContext> = {}): PluginRunContext => ({
  currentSlideId: 's2',
  selectedSlideIds: ['s2'],
  ...over
})

async function rigWith(...plugins: Array<ReturnType<typeof demoPlugin>>): Promise<PluginRig> {
  return makePluginRig({ registry: new PluginRegistry(inlineSources(plugins)) })
}

async function runPlugin(
  rig: PluginRig,
  pluginId: string,
  inputs: Record<string, unknown> = {},
  ctx: PluginRunContext = context()
) {
  const started = await rig.runner.run({ pluginId, lessonId: rig.lessonId, inputs, context: ctx })
  if (!started.ok) throw new Error(started.message)
  await rig.runner.whenDone(started.jobId)
  return started
}

describe('the sheet', () => {
  it('lists plugins and returns the manifest with the last inputs', async () => {
    const rig = await rigWith(
      demoPlugin('demo', noop, {
        inputs: [{ id: 'flag', type: 'boolean', label: 'Flag', default: false }]
      })
    )
    expect(rig.runner.list().map((p) => p.id)).toEqual(['demo'])
    expect(await rig.runner.getManifest('demo')).toMatchObject({
      ok: true,
      manifest: { id: 'demo', action: 'Run demo' },
      lastInputs: null
    })
    await runPlugin(rig, 'demo', { flag: true })
    expect(await rig.runner.getManifest('demo')).toMatchObject({ lastInputs: { flag: true } })
    expect(await rig.runner.getManifest('nope')).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('starting a run', () => {
  it('validates the plugin, the inputs, the lesson and the slides before starting a job', async () => {
    const rig = await rigWith(
      demoPlugin('demo', noop, {
        inputs: [
          {
            id: 'n',
            type: 'number',
            label: 'How many?',
            min: 1,
            max: 5,
            step: 1,
            default: 2,
            decrementLabel: 'Fewer',
            incrementLabel: 'More'
          }
        ]
      })
    )
    const base = { lessonId: rig.lessonId, context: context() }
    expect(await rig.runner.run({ ...base, pluginId: 'nope', inputs: {} })).toMatchObject({
      ok: false,
      code: 'not-found'
    })
    expect(await rig.runner.run({ ...base, pluginId: 'demo', inputs: { n: 'x' } })).toMatchObject({
      ok: false,
      code: 'invalid-input',
      message: 'How many?: enter a number'
    })
    expect(
      await rig.runner.run({
        pluginId: 'demo',
        lessonId: 'les_nope',
        inputs: {},
        context: context()
      })
    ).toMatchObject({ ok: false, code: 'not-found' })
    expect(rig.service.jobs.running(rig.lessonId)).toBeUndefined()
    expect(await rig.inputs.get('demo')).toBeNull()
  })

  it('refuses a plugin that needs slides on an empty lesson', async () => {
    const rig = await rigWith(demoPlugin('needy', noop, { needsSlides: true }))
    await rig.service.undo(rig.lessonId)
    expect(
      await rig.runner.run({
        pluginId: 'needy',
        lessonId: rig.lessonId,
        inputs: {},
        context: context()
      })
    ).toMatchObject({ ok: false, message: 'Make your slides first.' })
  })

  it('allows one job per lesson', async () => {
    let release = (): void => undefined
    const rig = await rigWith(
      demoPlugin(
        'slow',
        () => new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
      )
    )
    const first = await rig.runner.run({
      pluginId: 'slow',
      lessonId: rig.lessonId,
      inputs: {},
      context: context()
    })
    expect(first.ok).toBe(true)
    expect(
      await rig.runner.run({
        pluginId: 'slow',
        lessonId: rig.lessonId,
        inputs: {},
        context: context()
      })
    ).toMatchObject({ ok: false, message: LESSON_BUSY })
    release()
    if (first.ok) await rig.runner.whenDone(first.jobId)
  })

  it('remembers the validated inputs (defaults filled, unknown keys dropped)', async () => {
    const rig = await rigWith(
      demoPlugin('demo', noop, {
        inputs: [
          { id: 'a', type: 'boolean', label: 'A', default: true },
          { id: 't', type: 'text', label: 'T' }
        ]
      })
    )
    await runPlugin(rig, 'demo', { t: '  hi  ', extra: 1 })
    expect(await rig.inputs.get('demo')).toEqual({ a: true, t: 'hi' })
  })
})

describe('what the plugin is given', () => {
  async function captured(over: Partial<PluginRunContext> = {}) {
    let seen: PluginContext | undefined
    const rig = await rigWith(
      demoPlugin('demo', async (ctx) => {
        seen = ctx
      })
    )
    await runPlugin(rig, 'demo', {}, context(over))
    if (!seen) throw new Error('plugin did not run')
    return { ctx: seen, rig }
  }

  it('the deck read-only, the style and a selection checked against the deck', async () => {
    const { ctx, rig } = await captured({
      currentSlideId: 'gone',
      selectedSlideIds: ['s3', 'gone', 's1'],
      regions: [
        {
          id: 'r',
          n: 1,
          slideId: 'gone',
          path: [],
          bbox: { x: 0, y: 0, w: 1, h: 1 },
          targetElementIds: []
        }
      ]
    })
    expect(ctx).toMatchObject({
      pluginId: 'demo',
      lessonId: rig.lessonId,
      style: { id: 'sty_science_ks3' }
    })
    expect(ctx.deck.slides.map((s) => s.id)).toEqual(['s1', 's2', 's3'])
    expect(ctx.selection).toEqual({
      currentSlideId: 's1',
      selectedSlideIds: ['s1', 's3'],
      regions: []
    })
    expect(() => {
      ;(ctx.deck.slides as unknown as unknown[]).push({})
    }).toThrow()
    expect(() => {
      ctx.deck.title = 'x'
    }).toThrow()
    expect(ctx.newId('sld')).toMatch(/^sld_/)
  })

  it('structured calls carry the style profile (when the manifest uses it) and the cancel signal', async () => {
    const requests: Array<StructuredRequest<unknown>> = []
    const seen: Array<{ style: boolean }> = []
    const schema = z.object({ ok: z.boolean() })
    for (const usesStyle of [true, false]) {
      const rig = await makePluginRig({
        registry: new PluginRegistry(
          inlineSources([
            demoPlugin(
              'demo',
              async (ctx) => {
                orThrow(await ctx.ai.structured({ instructions: 'i', prompt: 'p', schema }))
              },
              { usesStyle }
            )
          ])
        ),
        fake: {
          structuredReply: (request: StructuredRequest<unknown>) => (
            requests.push(request),
            { ok: true }
          )
        }
      })
      await runPlugin(rig, 'demo')
      seen.push({
        style: requests.at(-1)?.profile !== null && requests.at(-1)?.profile !== undefined
      })
    }
    expect(seen).toEqual([{ style: true }, { style: false }])
  })
})

describe('what the plugin produces', () => {
  it('applyChanges is ONE undoable ChangeSet by the plugin; the live deck follows it', async () => {
    const decks: number[] = []
    const rig = await rigWith(
      demoPlugin('adder', async (ctx) => {
        decks.push(ctx.deck.slides.length)
        const applied = orThrow(
          await ctx.applyChanges(
            [
              { op: 'insertSlides', afterSlideId: 's3', slides: [makeSlide('q1'), makeSlide('q2')] }
            ],
            'Added 2 slides'
          )
        )
        decks.push(ctx.deck.slides.length)
        ctx.postMessage(`ChangeSet ${applied.changeSetId}`)
      })
    )
    await runPlugin(rig, 'adder')
    expect(decks).toEqual([3, 5])
    const [change] = rig.of('chat:changes') as Array<{
      changeSet: { by: string; pluginId: string; summary: string }
    }>
    expect(change.changeSet).toMatchObject({
      by: 'plugin',
      pluginId: 'adder',
      summary: 'Added 2 slides'
    })
    const opened = await rig.service.open(rig.lessonId)
    expect(opened.ok && opened.history.undoSummary).toBe('Added 2 slides')
    const undone = await rig.service.undo(rig.lessonId)
    expect(undone.ok && undone.deck.slides).toHaveLength(3)
    const [record] = (await rig.store.read(rig.lessonId)).filter((r) => r.ui.pluginId === 'adder')
    expect(record.ui.changeSetIds).toHaveLength(1)
  })

  it('applyChanges returns a failure for invalid ops and leaves the deck alone', async () => {
    let outcome: unknown
    const rig = await rigWith(
      demoPlugin('bad', async (ctx) => {
        outcome = await ctx.applyChanges([{ op: 'deleteSlides', slideIds: ['ghost'] }], 'x')
      })
    )
    await runPlugin(rig, 'bad')
    expect(outcome).toMatchObject({ ok: false, code: 'invalid-input' })
    expect(rig.of('chat:changes')).toEqual([])
    expect(rig.of('chat:done')).toHaveLength(1)
  })

  it('saveFile stores the file in the lesson, sends plugins:file and shows it in the message', async () => {
    const rig = await rigWith(
      demoPlugin('filer', async (ctx) => {
        orThrow(await ctx.saveFile('Worksheet.docx', Buffer.from('word')))
      })
    )
    const started = await runPlugin(rig, 'filer')
    const [event] = rig.of('plugins:file') as Array<{
      messageId: string
      file: { name: string; path: string; kind: string }
    }>
    expect(event).toMatchObject({
      messageId: started.messageId,
      file: { name: 'Worksheet.docx', kind: 'docx' }
    })
    expect(readFileSync(event.file.path, 'utf8')).toBe('word')
    const [record] = await rig.store.read(rig.lessonId)
    expect(record.ui.file).toEqual(event.file)
  })

  it('saveFile refuses unsupported file types without throwing', async () => {
    let outcome: unknown
    const rig = await rigWith(
      demoPlugin('filer', async (ctx) => {
        outcome = await ctx.saveFile('run.exe', Buffer.from('x'))
      })
    )
    await runPlugin(rig, 'filer')
    expect(outcome).toMatchObject({ ok: false, code: 'invalid-input' })
  })

  it('progress steps run in order, each marked done when the next starts', async () => {
    const rig = await rigWith(
      demoPlugin('steps', async (ctx) => {
        ctx.progress('Reading 3 slides…')
        ctx.progress('Writing…')
      })
    )
    await runPlugin(rig, 'steps')
    expect(rig.of('chat:status')).toEqual([
      expect.objectContaining({ step: 'Reading 3 slides…', state: 'running' }),
      expect.objectContaining({ step: 'Reading 3 slides…', state: 'done' }),
      expect.objectContaining({ step: 'Writing…', state: 'running' }),
      expect.objectContaining({ step: 'Writing…', state: 'done' })
    ])
  })

  it('the reply is the plugin’s messages and result, then chat:done', async () => {
    const rig = await rigWith(
      demoPlugin('talker', async (ctx) => {
        ctx.postMessage('First.')
        ctx.postMessage('   ')
        return { message: 'Second.' }
      })
    )
    await runPlugin(rig, 'talker')
    expect(rig.of('chat:delta')).toEqual([expect.objectContaining({ text: 'First.\nSecond.' })])
    expect(rig.names().slice(-2)).toEqual(['chat:delta', 'chat:done'])
  })

  it('says "Done." when the plugin has nothing to say', async () => {
    const rig = await rigWith(demoPlugin('quiet', noop))
    await runPlugin(rig, 'quiet')
    expect(rig.of('chat:delta')).toEqual([expect.objectContaining({ text: 'Done.' })])
  })
})

describe('when a plugin goes wrong', () => {
  it('an exception becomes a friendly error, frees the lesson and does not stop other plugins', async () => {
    const rig = await rigWith(
      demoPlugin('boom', async () => {
        throw new TypeError('x is undefined')
      }),
      demoPlugin('fine', async (ctx) => ctx.postMessage('ok'))
    )
    await runPlugin(rig, 'boom')
    expect(rig.of('ai:error')).toEqual([
      {
        scope: 'plugin',
        code: 'unknown',
        message: 'The plugin stopped unexpectedly. Nothing else was changed.',
        retryable: true
      }
    ])
    expect(rig.service.jobs.running(rig.lessonId)).toBeUndefined()
    await runPlugin(rig, 'fine')
    expect(rig.names().at(-1)).toBe('chat:done')
    const [error] = await rig.store.read(rig.lessonId)
    expect(error.ui).toMatchObject({
      pluginId: 'boom',
      error: { code: 'unknown', action: 'retry' }
    })
  })

  it('a PluginError carries its Claude failure (no key, no credit…)', async () => {
    const rig = await rigWith(
      demoPlugin('nokey', async () => {
        throw new PluginError(aiFailure('no-key'))
      })
    )
    await runPlugin(rig, 'nokey')
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ scope: 'plugin', code: 'no-key', retryable: false })
    ])
    expect((await rig.store.read(rig.lessonId))[0].ui.error?.action).toBe('settings')
  })

  it('a failing AI call surfaces through orThrow', async () => {
    const rig = await makePluginRig({
      registry: new PluginRegistry(
        inlineSources([
          demoPlugin('asker', async (ctx) => {
            orThrow(
              await ctx.ai.structured({
                instructions: 'i',
                prompt: 'p',
                schema: z.object({})
              })
            )
          })
        ])
      ),
      fake: { failWith: 'network' }
    })
    await runPlugin(rig, 'asker')
    expect(rig.of('ai:error')).toEqual([
      expect.objectContaining({ code: 'network', retryable: true })
    ])
  })

  it('Stop ends the run as cancelled; a change already applied is kept and said so', async () => {
    const rig = await rigWith(
      demoPlugin('stoppable', async (ctx) => {
        orThrow(await ctx.applyChanges([{ op: 'setMeta', title: 'Changed' }], 'Retitled'))
        ctx.progress('Waiting…')
        await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve))
        ctx.signal.throwIfAborted()
      })
    )
    const started = await rig.runner.run({
      pluginId: 'stoppable',
      lessonId: rig.lessonId,
      inputs: {},
      context: context()
    })
    if (!started.ok) throw new Error(started.message)
    while (rig.of('chat:status').length === 0) await new Promise((r) => setTimeout(r, 1))
    rig.runner.cancel(started.jobId)
    await rig.runner.whenDone(started.jobId)
    expect(rig.names().at(-1)).toBe('chat:done')
    expect(rig.names()).not.toContain('ai:error')
    const [record] = await rig.store.read(rig.lessonId)
    expect(record.ui.error).toEqual({
      code: 'cancelled',
      message: 'Stopped. The changes already made were kept.'
    })
    expect(rig.of('chat:status').at(-1)).toMatchObject({ state: 'error' })
  })

  it('Stop before anything changed says nothing was changed', async () => {
    const rig = await rigWith(
      demoPlugin('stoppable', async (ctx) => {
        await new Promise((resolve) => ctx.signal.addEventListener('abort', resolve))
        throw new Error('whatever the plugin throws after Stop')
      })
    )
    const started = await rig.runner.run({
      pluginId: 'stoppable',
      lessonId: rig.lessonId,
      inputs: {},
      context: context()
    })
    if (!started.ok) throw new Error(started.message)
    await new Promise((r) => setTimeout(r, 5))
    rig.runner.cancel(started.jobId)
    await rig.runner.whenDone(started.jobId)
    expect((await rig.store.read(rig.lessonId))[0].ui.error?.message).toBe(
      'Stopped. Nothing was changed.'
    )
  })
})

describe('the chat bridge', () => {
  it('lists plugins with their manifests for list_plugins', async () => {
    const rig = await rigWith(demoPlugin('demo', noop, { order: 1 }))
    const listed = rig.runner.chatBridge().list() as Array<{
      id: string
      manifest: { action: string }
    }>
    expect(listed).toEqual([
      expect.objectContaining({
        id: 'demo',
        manifest: expect.objectContaining({ action: 'Run demo' })
      })
    ])
  })

  it('runs a plugin inside the chat job, with defaults, and reports what it made', async () => {
    const rig = await rigWith(
      demoPlugin(
        'maker',
        async (ctx) => {
          orThrow(await ctx.applyChanges([{ op: 'setMeta', title: 'From plugin' }], 'Retitled'))
          orThrow(await ctx.saveFile('Out.docx', Buffer.from('x')))
          ctx.postMessage('Made it.')
        },
        { inputs: [{ id: 'n', type: 'boolean', label: 'N', default: true }] }
      )
    )
    const changes: string[] = []
    const files: string[] = []
    const result = await rig.runner.chatBridge().run({
      lessonId: rig.lessonId,
      pluginId: 'maker',
      inputs: {},
      currentSlideId: 's2',
      signal: new AbortController().signal,
      messageId: 'msg_chat',
      report: { change: (id) => changes.push(id), file: (f) => files.push(f.name) }
    })
    expect(result).toEqual({ ok: true, summary: 'Made it.', changes: 1 })
    expect(changes).toHaveLength(1)
    expect(files).toEqual(['Out.docx'])
    expect(rig.of('chat:changes')).toHaveLength(1)
    // The chat turn owns the message: no second message and no chat:done from the plugin.
    expect(await rig.store.read(rig.lessonId)).toEqual([])
    expect(rig.names()).not.toContain('chat:done')
  })

  it('tells Claude why a plugin failed instead of throwing', async () => {
    const rig = await rigWith(
      demoPlugin('boom', async () => {
        throw new Error('x')
      }),
      demoPlugin('needy', noop, {
        inputs: [{ id: 'r', type: 'text', label: 'Topic', required: true }]
      })
    )
    const bridge = rig.runner.chatBridge()
    const base = {
      lessonId: rig.lessonId,
      currentSlideId: 's1',
      signal: new AbortController().signal,
      messageId: 'm',
      report: { change: noop, file: noop }
    }
    expect(await bridge.run({ ...base, pluginId: 'boom', inputs: {} })).toEqual({
      ok: false,
      error: 'The plugin stopped unexpectedly. Nothing else was changed.'
    })
    expect(await bridge.run({ ...base, pluginId: 'needy', inputs: {} })).toEqual({
      ok: false,
      error: 'Topic: this is required'
    })
    expect(await bridge.run({ ...base, pluginId: 'nope', inputs: {} })).toMatchObject({ ok: false })
  })
})
