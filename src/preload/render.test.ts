import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RENDER_CHANNELS } from '@main/render/ipc'
import type { RenderBridge, RenderJob } from '@shared/annotate/renderJob'
import { fixtureDeck } from '@shared/deck/testing'

type Handler = (event: unknown, payload: unknown) => void

const electron = vi.hoisted(() => ({
  exposed: {} as Record<string, unknown>,
  handlers: new Map<string, Set<Handler>>(),
  sent: [] as Array<[string, unknown?]>
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => {
      electron.exposed[name] = api
    }
  },
  ipcRenderer: {
    on: (channel: string, handler: Handler) => {
      const set = electron.handlers.get(channel) ?? new Set()
      electron.handlers.set(channel, set)
      set.add(handler)
    },
    removeListener: (channel: string, handler: Handler) => {
      electron.handlers.get(channel)?.delete(handler)
    },
    send: (channel: string, payload?: unknown) => {
      electron.sent.push([channel, payload])
    }
  }
}))

const job = (): RenderJob => ({
  id: 'job-1',
  slide: fixtureDeck().slides[0],
  style: null,
  assets: {},
  viewport: { x: 0, y: 0, w: 1920, h: 1080 },
  scale: 0.5,
  regions: [],
  strokes: []
})

const deliver = (payload: unknown): void =>
  electron.handlers.get(RENDER_CHANNELS.job)?.forEach((handler) => handler({}, payload))

describe('render preload', () => {
  let bridge: RenderBridge

  beforeEach(async () => {
    vi.resetModules()
    electron.handlers.clear()
    electron.sent.length = 0
    await import('./render')
    bridge = electron.exposed.slideRender as RenderBridge
  })

  it('exposes only slideRender, with exactly three functions', () => {
    expect(Object.keys(electron.exposed)).toEqual(['slideRender'])
    expect(Object.keys(bridge).sort()).toEqual(['listening', 'onJob', 'report'])
  })

  it('hands well-formed jobs from the job channel to the page', () => {
    const received: RenderJob[] = []
    bridge.onJob((next) => received.push(next))
    deliver(job())
    expect(received).toEqual([job()])
  })

  it('drops messages that are not render jobs', () => {
    const received: RenderJob[] = []
    bridge.onJob((next) => received.push(next))
    deliver({ id: 'x' })
    deliver('hello')
    deliver({ ...job(), assets: { a: 'https://example.com/a.png' } })
    deliver({ ...job(), scale: 100 })
    expect(received).toEqual([])
  })

  it('stops delivering after unsubscribe', () => {
    const received: RenderJob[] = []
    const stop = bridge.onJob((next) => received.push(next))
    stop()
    deliver(job())
    expect(received).toEqual([])
    expect(electron.handlers.get(RENDER_CHANNELS.job)?.size).toBe(0)
  })

  it('tells main when it is listening and when a job is drawn, on the dedicated channels', () => {
    bridge.listening()
    bridge.report({ id: 'job-1', ok: true })
    expect(electron.sent).toEqual([
      [RENDER_CHANNELS.listening, undefined],
      [RENDER_CHANNELS.report, { id: 'job-1', ok: true }]
    ])
  })
})
