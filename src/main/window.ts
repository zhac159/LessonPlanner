import { app, BrowserWindow, screen, shell } from 'electron'
import { resolveAutomation, type Automation } from './automation'
import { centeredBounds, parseDisplayOverride, pickDisplay } from './services/display'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IPC } from '@shared/ipc'
import { APP_CONFIG, TEST_MODE_ARG } from '@shared/appConfig'
import icon from '../../resources/icon.png?asset'
import { createLogger } from './logger'

const log = createLogger('window')

/** If the page never reports ready (e.g. it failed to load), show the window anyway so the app is not invisible. */
const SHOW_FALLBACK_MS = 8000

let mainWindow: BrowserWindow | null = null

/** Set by `electron-vite dev`; undefined for production builds and `electron .`. */
const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

/**
 * Brings the main window to the front, also when it is hidden (a leftover automated run, or a window that has
 * not reported ready yet): the owner starting the app a second time must always get to see it. A window that sat
 * on the automation monitor is moved to the primary one first.
 */
export function focusMainWindow(): void {
  const win = getMainWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) {
    if (automation().automated) {
      const display = screen.getPrimaryDisplay()
      win.setBounds(centeredBounds(display.workArea, { width: 1280, height: 800 }))
    }
    win.show()
  }
  win.focus()
}

/**
 * Automated runs (Playwright, e2e, screenshots) must not pop up over the owner's work: they stay
 * hidden (SLIDE_PLANNER_HEADLESS=0 forces a visible window) and, if shown, use the second monitor.
 * Normal launches are untouched: primary monitor, visible. A packaged build ignores all of it unless
 * launched with `--slide-planner-automation` (see automation.ts).
 */
let resolved: Automation | undefined
const automation = (): Automation =>
  (resolved ??= resolveAutomation({
    env: process.env,
    argv: process.argv,
    isPackaged: app.isPackaged
  }))

export interface MainWindowOptions {
  /** Called once when the window has been closed (by the user, by the API or by quitting). */
  onClosed?: () => void
}

export function createMainWindow(options: MainWindowOptions = {}): BrowserWindow {
  const { automated, hidden, testMode, displayEnv } = automation()
  const display = pickDisplay(screen.getAllDisplays(), screen.getPrimaryDisplay().id, {
    secondary: automated,
    index: parseDisplayOverride(displayEnv)
  })
  const bounds = centeredBounds(display.workArea, { width: 1280, height: 800 })
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 1100,
    minHeight: 600,
    show: false,
    // Frameless: the renderer draws its own title bar and window controls (see TitleBar.tsx).
    frame: false,
    backgroundColor: APP_CONFIG.windowBackground,
    title: APP_CONFIG.appName,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // A hidden window must keep painting and running animations so screenshots look right.
      backgroundThrottling: !hidden,
      // The preload reads this flag (SLIDE_PLANNER_TEST=1) to expose `api.testMode`.
      additionalArguments: testMode ? [TEST_MODE_ARG] : []
    }
  })
  mainWindow = win

  const showFallback = setTimeout(() => {
    if (!hidden && !win.isDestroyed() && !win.isVisible()) {
      log.warn(`Page not ready after ${SHOW_FALLBACK_MS} ms; showing the window anyway`)
      win.show()
    }
  }, SHOW_FALLBACK_MS)
  win.once('ready-to-show', () => {
    if (hidden) return
    // Automated runs that are shown must not steal focus from what the owner is doing.
    if (automated) win.showInactive()
    else win.show()
  })
  win.once('show', () => clearTimeout(showFallback))
  win.on('closed', () => {
    clearTimeout(showFallback)
    if (mainWindow === win) mainWindow = null
    options.onClosed?.()
  })

  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) log.error(`Failed to load ${url}: ${description} (${code})`)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error(`Renderer process gone: ${details.reason}`)
  })

  const notifyMaximized = (): void => {
    if (!win.isDestroyed()) win.webContents.send(IPC.window.maximizedChanged, win.isMaximized())
  }
  win.on('maximize', notifyMaximized)
  win.on('unmaximize', notifyMaximized)

  // The renderer is a sandboxed page: it never navigates away or opens windows.
  // Web links go to the user's default browser instead.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => {
    if (isAppUrl(event.url)) return
    event.preventDefault()
    openExternal(event.url)
  })
  // Subframes and server redirects must not slip past the lock either.
  win.webContents.on('will-frame-navigate', (event) => {
    if (!isAppUrl(event.url)) event.preventDefault()
  })
  win.webContents.on('will-redirect', (event) => {
    if (!isAppUrl(event.url)) event.preventDefault()
  })

  if (!app.isPackaged) attachDevShortcuts(win)

  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

const appPageUrl = pathToFileURL(join(__dirname, '../renderer/index.html'))

/** True only for the app's own page (the built index.html, or the dev server's origin). Query and hash are ignored. */
export function isAppUrl(url: string): boolean {
  try {
    const target = new URL(url)
    if (devServerUrl) return target.origin === new URL(devServerUrl).origin
    return target.protocol === 'file:' && target.pathname === appPageUrl.pathname
  } catch {
    return false
  }
}

function openExternal(url: string): void {
  try {
    const { protocol } = new URL(url)
    if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url)
  } catch {
    // Not a valid URL: ignore.
  }
}

/** Development only: there is no menu bar, so wire up DevTools and reload by hand. */
function attachDevShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    } else if (input.control && !input.shift && key === 'r') {
      win.webContents.reload()
      event.preventDefault()
    }
  })
}
