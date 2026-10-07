import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'

const send = vi.fn()
let hasWindow = true
vi.mock('./window', () => ({ getMainWindow: () => (hasWindow ? { webContents: { send } } : null) }))
vi.mock('./logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const {
  emitModuleEvent,
  holdInvocationsUntil,
  invokeHandler,
  refuseInvocations,
  registerHandler,
  removeModuleHandlers
} = await import('./moduleBus')

beforeEach(() => {
  send.mockClear()
  hasWindow = true
})

describe('registerHandler / invokeHandler', () => {
  it('calls the registered handler with the arguments and wraps the value', async () => {
    registerHandler('bus-a', 'add', (a, b) => (a as number) + (b as number))
    expect(await invokeHandler('bus-a', 'add', [1, 2])).toEqual({ ok: true, value: 3 })
  })

  it('awaits async handlers', async () => {
    registerHandler('bus-a', 'later', async () => 'done')
    expect(await invokeHandler('bus-a', 'later', [])).toEqual({ ok: true, value: 'done' })
  })

  it('turns a throwing handler into an error result', async () => {
    registerHandler('bus-a', 'boom', () => {
      throw new Error('kaput')
    })
    expect(await invokeHandler('bus-a', 'boom', [])).toEqual({ ok: false, error: 'kaput' })
  })

  it('reports an unknown handler instead of throwing', async () => {
    const result = await invokeHandler('bus-a', 'missing', [])
    expect(result).toMatchObject({ ok: false })
    expect(result.ok === false && result.error).toContain('No handler "missing"')
  })

  it('rejects bad channel names and duplicates', () => {
    expect(() => registerHandler('bus-b', 'has space', () => 1)).toThrow('Invalid channel name')
    registerHandler('bus-b', 'once', () => 1)
    expect(() => registerHandler('bus-b', 'once', () => 2)).toThrow('already has a handler')
  })

  it('accepts colon names used by contracts', async () => {
    registerHandler('bus-b', 'jobs:cancel', () => 'ok')
    expect(await invokeHandler('bus-b', 'jobs:cancel', [])).toEqual({ ok: true, value: 'ok' })
  })
})

describe('removeModuleHandlers', () => {
  it('removes only that module handlers', async () => {
    registerHandler('bus-c', 'x', () => 1)
    registerHandler('bus-d', 'x', () => 2)
    removeModuleHandlers('bus-c')
    expect(await invokeHandler('bus-c', 'x', [])).toMatchObject({ ok: false })
    expect(await invokeHandler('bus-d', 'x', [])).toEqual({ ok: true, value: 2 })
  })
})

describe('holdInvocationsUntil', () => {
  it('makes an early call wait for the modules instead of failing with "no handler"', async () => {
    let finishStartup: () => void = () => undefined
    holdInvocationsUntil(new Promise<void>((resolve) => (finishStartup = resolve)))
    const early = invokeHandler('bus-late', 'ping', [])
    registerHandler('bus-late', 'ping', () => 'pong') // the module activates after the call arrived
    finishStartup()
    expect(await early).toEqual({ ok: true, value: 'pong' })
  })

  it('still answers when startup failed', async () => {
    holdInvocationsUntil(Promise.reject(new Error('boom')))
    expect(await invokeHandler('bus-none', 'x', [])).toMatchObject({ ok: false })
  })
})

describe('emitModuleEvent', () => {
  it('pushes a module event to the window', () => {
    emitModuleEvent('home', 'tick', { n: 1 })
    expect(send).toHaveBeenCalledWith(IPC.modules.event, {
      moduleId: 'home',
      channel: 'tick',
      payload: { n: 1 }
    })
  })

  it('does nothing without a window', () => {
    hasWindow = false
    emitModuleEvent('home', 'tick', 1)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('calls from the page are validated', () => {
  beforeAll(() => registerHandler('bus-v', 'x', () => 'reached'))

  it.each([
    ['a module id with a colon (it would alias another module key)', 'bus-a:evil', 'x'],
    ['an upper-case module id', 'Bus', 'x'],
    ['a __proto__ module id', '__proto__', 'x'],
    ['a channel with a space', 'bus-a', 'has space'],
    ['an over-long channel', 'bus-a', `a${'b'.repeat(200)}`],
    ['an empty module id', '', 'x']
  ])('refuses %s without looking for a handler', async (_name, moduleId, channel) => {
    const result = await invokeHandler(moduleId, channel, [])
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/^Invalid /)
  })

  it('refuses non-array and oversized argument lists, and non-string names', async () => {
    registerHandler('bus-v', 'args', (...a) => a.length)
    expect(await invokeHandler('bus-v', 'args', 'nope' as unknown as unknown[])).toMatchObject({
      ok: false,
      error: 'Invalid arguments'
    })
    expect(await invokeHandler('bus-v', 'args', new Array(33).fill(0))).toMatchObject({ ok: false })
    expect(await invokeHandler('bus-v', 'args', new Array(32).fill(0))).toEqual({
      ok: true,
      value: 32
    })
    expect(await invokeHandler(7 as unknown as string, 'args', [])).toMatchObject({ ok: false })
    expect(await invokeHandler('bus-v', {} as unknown as string, [])).toMatchObject({ ok: false })
  })

  it('rejects an over-long channel at registration too', () => {
    expect(() => registerHandler('bus-v', `a${'b'.repeat(200)}`, () => 1)).toThrow(
      'Invalid channel'
    )
  })
})

// Keep last: refusing is permanent for the process (the app is quitting).
describe('refuseInvocations', () => {
  it('answers every later call with the refusal, even for registered handlers', async () => {
    registerHandler('bus-q', 'work', () => 'started a job')
    expect(await invokeHandler('bus-q', 'work', [])).toEqual({ ok: true, value: 'started a job' })
    refuseInvocations('Slide Planner is closing')
    expect(await invokeHandler('bus-q', 'work', [])).toEqual({
      ok: false,
      error: 'Slide Planner is closing'
    })
  })
})
