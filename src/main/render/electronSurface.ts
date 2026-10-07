/**
 * The Electron side of the renderer: one hidden, sandboxed BrowserWindow that shows render.html, takes a
 * job over the dedicated channel and returns the window's pixels as a PNG. Not unit-tested (it needs a
 * real Chromium); `scripts/render-check.mjs` runs it for real and the SlideRenderer rules around it are
 * unit-tested with a fake surface.
 */
import { BrowserWindow, ipcMain, session, type IpcMainEvent } from 'electron'
import { jobPixelSize, type RenderJob, type RenderReport } from '@shared/annotate/renderJob'
import { RENDER_CHANNELS } from './ipc'
import { isAllowedRenderUrl } from './location'
import type { RenderSurface } from './SlideRenderer'

export interface ElectronSurfaceOptions {
  /** URL of render.html (see location.ts). */
  pageUrl: string
  /** Absolute path of the built render preload (`out/preload/render.js`). */
  preloadPath: string
  /** Debugging only: keep the window visible. */
  visible?: boolean
}

interface Pending {
  resolve: () => void
  reject: (error: Error) => void
}

const isReport = (value: unknown): value is RenderReport =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RenderReport).id === 'string' &&
  typeof (value as RenderReport).ok === 'boolean'

/** A RenderSurface backed by a hidden BrowserWindow, created on the first job and kept until disposed. */
export function createElectronSurface(options: ElectronSurfaceOptions): RenderSurface {
  let window: BrowserWindow | null = null
  let loaded: Promise<BrowserWindow> | null = null
  let disposed = false
  const pending = new Map<string, Pending>()
  const listeners: Array<() => void> = []

  const failAll = (error: Error): void => {
    for (const entry of pending.values()) entry.reject(error)
    pending.clear()
  }

  const open = (): Promise<BrowserWindow> => {
    // Own in-memory session: no cookies or cache shared with the app, and nothing but the page may load.
    const renderSession = session.fromPartition('slide-render')
    renderSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    renderSession.webRequest.onBeforeRequest((details, callback) =>
      callback({ cancel: !isAllowedRenderUrl(details.url, options.pageUrl) })
    )
    const win = new BrowserWindow({
      show: options.visible === true,
      width: 1280,
      height: 720,
      useContentSize: true,
      frame: false,
      skipTaskbar: true,
      focusable: options.visible === true,
      backgroundColor: '#ffffff',
      paintWhenInitiallyHidden: true,
      webPreferences: {
        partition: 'slide-render',
        preload: options.preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        devTools: false,
        // A hidden window must keep painting or the capture comes back blank.
        backgroundThrottling: false
      }
    })
    window = win
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event) => event.preventDefault())
    win.on('closed', () => {
      window = null
      loaded = null
      failAll(new Error('The render window was closed'))
    })
    win.webContents.on('render-process-gone', (_event, details) =>
      failAll(new Error(`The render process ended (${details.reason})`))
    )

    const fromWindow = (event: IpcMainEvent): boolean => event.sender === win.webContents
    const onReport = (event: IpcMainEvent, report: unknown): void => {
      if (!fromWindow(event) || !isReport(report)) return
      const entry = pending.get(report.id)
      if (!entry) return
      pending.delete(report.id)
      if (report.ok) entry.resolve()
      else entry.reject(new Error(report.error))
    }
    ipcMain.on(RENDER_CHANNELS.report, onReport)
    listeners.push(() => ipcMain.removeListener(RENDER_CHANNELS.report, onReport))

    return new Promise<BrowserWindow>((resolve, reject) => {
      const onListening = (event: IpcMainEvent): void => {
        if (!fromWindow(event)) return
        ipcMain.removeListener(RENDER_CHANNELS.listening, onListening)
        resolve(win)
      }
      ipcMain.on(RENDER_CHANNELS.listening, onListening)
      listeners.push(() => ipcMain.removeListener(RENDER_CHANNELS.listening, onListening))
      win.webContents.once('did-fail-load', (_event, code, description) =>
        reject(new Error(`The render page failed to load: ${description} (${code})`))
      )
      void win.loadURL(options.pageUrl)
    })
  }

  return {
    async render(job: RenderJob): Promise<Uint8Array> {
      if (disposed) throw new Error('The render surface was disposed')
      loaded ??= open()
      const win = await loaded
      const { width, height } = jobPixelSize(job)
      win.setContentSize(width, height)
      const drawn = new Promise<void>((resolve, reject) => pending.set(job.id, { resolve, reject }))
      win.webContents.send(RENDER_CHANNELS.job, job)
      await drawn
      const image = await win.webContents.capturePage()
      const size = image.getSize()
      // A high-DPI display makes the capture larger than the job: bring it back to the exact size.
      const exact =
        size.width === width && size.height === height
          ? image
          : image.resize({ width, height, quality: 'best' })
      return new Uint8Array(exact.toPNG())
    },

    dispose(): void {
      disposed = true
      failAll(new Error('The render surface was disposed'))
      for (const remove of listeners.splice(0)) remove()
      if (window && !window.isDestroyed()) window.destroy()
      window = null
      loaded = null
    }
  }
}
