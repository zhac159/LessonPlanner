import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '@shared/ipc'

type Listener = (event: unknown, ...args: unknown[]) => unknown
const listeners = new Map<string, Listener>()
const handlers = new Map<string, Listener>()

vi.mock('electron', () => ({
  app: {
    getName: () => 'Slide Planner',
    getVersion: () => '1.2.3',
    isPackaged: false
  },
  ipcMain: {
    on: (channel: string, listener: Listener) => listeners.set(channel, listener),
    handle: (channel: string, handler: Listener) => handlers.set(channel, handler)
  }
}))

const mainFrame = { url: 'file:///app/index.html' }
const win = {
  webContents: { mainFrame },
  minimize: vi.fn(),
  close: vi.fn(),
  setFullScreen: vi.fn(),
  isMaximized: vi.fn(() => true)
}
vi.mock('./window', () => ({
  getMainWindow: () => win,
  isAppUrl: (url: string) => url.startsWith('file:///app/')
}))

let root: string | undefined = 'C:\data'
let replaced: string | undefined
vi.mock('./services/paths', () => ({
  dataRootIfSet: () => root,
  dataRootFallbackFrom: () => replaced
}))

const invokeHandler = vi.fn(async (..._args: unknown[]) => ({ ok: true as const, value: 42 }))
vi.mock('./moduleBus', () => ({
  invokeHandler: (...args: unknown[]) => invokeHandler(...args)
}))

const { registerCoreIpc } = await import('./ipc')

const trusted = { sender: win.webContents, senderFrame: mainFrame }
const otherWindow = { sender: {}, senderFrame: mainFrame }
const subframe = { sender: win.webContents, senderFrame: { url: 'file:///app/index.html' } }
const wrongPage = {
  sender: win.webContents,
  senderFrame: { ...mainFrame, url: 'https://evil.test/' }
}

beforeEach(() => {
  vi.clearAllMocks()
  listeners.clear()
  handlers.clear()
  registerCoreIpc()
})

describe('window:set-fullscreen', () => {
  it('toggles full screen for the trusted sender', () => {
    listeners.get(IPC.window.setFullScreen)?.(trusted, true)
    expect(win.setFullScreen).toHaveBeenCalledWith(true)
    listeners.get(IPC.window.setFullScreen)?.(trusted, false)
    expect(win.setFullScreen).toHaveBeenLastCalledWith(false)
  })

  it('ignores non-boolean payloads', () => {
    listeners.get(IPC.window.setFullScreen)?.(trusted, 'yes')
    expect(win.setFullScreen).not.toHaveBeenCalled()
  })

  it.each([
    ['another window', otherWindow],
    ['a subframe', subframe],
    ['a foreign page', wrongPage]
  ])('ignores %s', (_name, event) => {
    listeners.get(IPC.window.setFullScreen)?.(event, true)
    expect(win.setFullScreen).not.toHaveBeenCalled()
  })
})

describe('window controls', () => {
  it('minimise and close act only for the trusted sender', () => {
    listeners.get(IPC.window.minimize)?.(trusted)
    listeners.get(IPC.window.close)?.(trusted)
    listeners.get(IPC.window.minimize)?.(otherWindow)
    listeners.get(IPC.window.close)?.(wrongPage)
    expect(win.minimize).toHaveBeenCalledTimes(1)
    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('reports maximised only to the trusted sender', () => {
    expect(handlers.get(IPC.window.isMaximized)?.(trusted)).toBe(true)
    expect(handlers.get(IPC.window.isMaximized)?.(otherWindow)).toBe(false)
  })
})

describe('app:info', () => {
  it('returns app details to the trusted sender and throws for others', () => {
    const info = handlers.get(IPC.app.info)?.(trusted) as { name: string; version: string }
    expect(info).toMatchObject({ name: 'Slide Planner', version: '1.2.3' })
    expect(() => handlers.get(IPC.app.info)?.(otherWindow)).toThrow('Untrusted IPC sender')
  })

  it('says where the lessons are saved, and when that is the per-user fallback', () => {
    expect(handlers.get(IPC.app.info)?.(trusted)).toMatchObject({ dataRoot: 'C:\data' })
    replaced = 'C:\Apps\Slide Planner\data'
    expect(handlers.get(IPC.app.info)?.(trusted)).toMatchObject({
      dataRoot: 'C:\data',
      dataRootFallbackFrom: 'C:\Apps\Slide Planner\data'
    })
    replaced = undefined
  })
})

describe('modules:invoke', () => {
  it('routes to the module bus', async () => {
    const result = await handlers.get(IPC.modules.invoke)?.(trusted, 'home', 'ping', 1, 2)
    expect(result).toEqual({ ok: true, value: 42 })
    expect(invokeHandler).toHaveBeenCalledWith('home', 'ping', [1, 2])
  })

  it('refuses untrusted senders and non-string names without reaching the bus', async () => {
    const run = handlers.get(IPC.modules.invoke)!
    expect(await run(otherWindow, 'home', 'ping')).toEqual({
      ok: false,
      error: 'Untrusted IPC sender'
    })
    expect(await run(trusted, 7, 'ping')).toMatchObject({ ok: false })
    expect(invokeHandler).not.toHaveBeenCalled()
  })
})
