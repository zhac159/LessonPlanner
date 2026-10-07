// Shared helpers for integration flows (scripts/e2e/*.e2e.mjs) and scripts/shot.mjs.
// Launches the BUILT app (out/, or a packaged exe) with Playwright; the caller builds first.
//
//   const { app, page, close } = await launchApp({ seed: 'two-lessons' })
//   await waitForSplashGone(page)
//   await go(page, 'deck-builder', { lessonId: 'dck_1' })
//   check('editor is shown', await page.locator('[data-testid="module-deck-builder"]').isVisible())
//   await close()
import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanElectronEnv } from './args.mjs'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const shotDir = join(root, '.artifacts', 'shots')

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const removeDir = (dir) =>
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

/** Environment for a test-mode launch: throwaway data folder, fake AI, no ELECTRON_RUN_AS_NODE. */
export function appEnvironment({ dataDir, fakeAi = true, seed, env = {} }) {
  return {
    ...cleanElectronEnv(process.env),
    SLIDE_PLANNER_DATA_DIR: dataDir,
    SLIDE_PLANNER_TEST: '1',
    ...(fakeAi ? { SLIDE_PLANNER_FAKE_AI: '1' } : {}),
    ...(seed ? { SLIDE_PLANNER_SEED: seed } : {}),
    ...env
  }
}

/**
 * The app window is hidden (never shown on the owner's machine) and a hidden window paints about one frame every two
 * seconds, so Playwright's click, which waits for the element to be "stable" over two animation frames, would cost 2 s
 * each. Locator.click is patched once: it still waits (strictly) for the element to be visible, enabled and not covered, then
 * clicks with `force` (only the two-frame stability wait is dropped). `{ force, trial }` calls and a visible window are left alone.
 */
let clicksPatched = false
function patchClicks(page) {
  if (clicksPatched || process.env.SLIDE_PLANNER_HEADLESS === '0') return
  clicksPatched = true
  const proto = Object.getPrototypeOf(page.locator('body'))
  const original = proto.click
  proto.click = async function click(options = {}) {
    if (options.force || options.trial) return original.call(this, options)
    const timeout = options.timeout ?? 15_000
    await this.waitFor({ state: 'visible', timeout })
    // Enabled, and not covered by something else (a toast, a dialog): what Playwright's own checks would wait for.
    const ready = await waitUntil(
      () =>
        this.evaluate((element) => {
          if (element.disabled || element.getAttribute('aria-disabled') === 'true') return false
          element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          const box = element.getBoundingClientRect()
          const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return top !== null && (element.contains(top) || top.contains(element))
        }),
      Boolean,
      timeout
    )
    if (!ready) throw new Error(`click: element stayed disabled or covered: ${String(this)}`)
    return original.call(this, { ...options, force: true })
  }
}

const isHelperWindow = (url) => url === '' || url === 'about:blank' || url.endsWith('/render.html')

/** The app's window: not the hidden slide-render window, which can open first (seeds) or last. */
async function appWindow(app) {
  const pick = () => app.windows().find((w) => !isHelperWindow(w.url()))
  const deadline = Date.now() + 20_000
  for (let page = pick(); ; page = pick()) {
    if (page) return page
    if (Date.now() > deadline) return app.firstWindow()
    await sleep(100)
  }
}

/**
 * Starts the app on a throwaway data folder.
 * @param {object} [options]
 * @param {boolean} [options.fakeAi=true] Use the deterministic fake Claude (SLIDE_PLANNER_FAKE_AI=1).
 * @param {string} [options.dataDir] Data folder to use (kept on close). Default: a fresh temp folder (removed on close).
 * @param {string} [options.seed] Passed as SLIDE_PLANNER_SEED; src/main/dev/seed.ts fills the data folder from it.
 * @param {Record<string,string>} [options.env] Extra environment variables.
 * @param {string} [options.exe] Path to a packaged .exe instead of the dev build in out/.
 * @param {boolean} [options.reducedMotion=false] Emulate prefers-reduced-motion (no animations: stable screenshots).
 * @param {{ width: number, height: number }} [options.size] Content size of the window.
 * @returns {Promise<{ app: import('playwright-core').ElectronApplication, page: import('playwright-core').Page, dataDir: string, errors: string[], close: () => Promise<void> }>}
 */
export async function launchApp({
  fakeAi = true,
  dataDir,
  seed,
  env = {},
  exe,
  reducedMotion = false,
  size
} = {}) {
  const ownsDataDir = dataDir === undefined
  const dataFolder = dataDir ?? mkdtempSync(join(tmpdir(), 'slide-planner-data-'))
  // The Electron profile (cache, single-instance lock) is separate from the app's data folder.
  const profileDir = mkdtempSync(join(tmpdir(), 'slide-planner-profile-'))
  const packaged = exe ? resolve(root, exe) : undefined
  const executablePath = packaged ?? createRequire(import.meta.url)('electron')
  const launchEnv = appEnvironment({ dataDir: dataFolder, fakeAi, seed, env })
  const app = await electron.launch({
    executablePath,
    // The unlock lets a PACKAGED build honour SLIDE_PLANNER_TEST / HEADLESS / CLAUDECODE (src/main/automation.ts);
    // a dev build ignores it. Without it the owner's real launches could never be hidden by a stray variable.
    args: [
      ...(packaged ? [] : [root]),
      `--user-data-dir=${profileDir}`,
      '--slide-planner-automation'
    ],
    cwd: root,
    env: launchEnv,
    timeout: 60_000
  })
  const errors = []
  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    await app.close().catch(() => {})
    await sleep(300)
    removeDir(profileDir)
    if (ownsDataDir) removeDir(dataFolder)
  }
  try {
    const page = await appWindow(app)
    page.setDefaultTimeout(15_000)
    patchClicks(page)
    page.electronApp = app // lets shot() capture hidden windows through Electron
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
    })
    if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' })
    if (size) {
      await app.evaluate(({ BrowserWindow }, { width, height }) => {
        // The app window, not the hidden render window that exports and thumbnails use.
        const appWin = BrowserWindow.getAllWindows().find(
          (w) => !w.webContents.getURL().endsWith('/render.html')
        )
        appWin?.setContentSize(width, height)
      }, size)
      // The stage re-measures on resize: let it settle before anything is captured.
      await new Promise((done) => setTimeout(done, 500))
    }
    return { app, page, dataDir: dataFolder, errors, close }
  } catch (error) {
    await close()
    throw error
  }
}

/** Resolves when the welcome splash is gone (also when it never appeared). */
export async function waitForSplashGone(page, timeout = 20_000) {
  await page.waitForSelector('[data-testid="splash"]', { state: 'detached', timeout })
}

/** Jumps to a module through the test hook (`window.__shell`, exposed when SLIDE_PLANNER_TEST=1). */
export async function go(page, moduleId, intent) {
  await page.waitForFunction(() => window.__shell !== undefined, undefined, { timeout: 15_000 })
  const known = await page.evaluate(() => window.__shell.getState().modules.map((m) => m.id))
  if (!known.includes(moduleId)) {
    throw new Error(`No module "${moduleId}" is loaded (loaded: ${known.join(', ') || 'none'})`)
  }
  await page.evaluate(([id, nav]) => window.__shell.navigate(id, nav), [moduleId, intent])
  await page.waitForSelector(`[data-testid="module-${moduleId}"]`, {
    state: 'visible',
    timeout: 10_000
  })
}

/**
 * Waits until the page is visually still: fonts loaded, no running animations (best with
 * reducedMotion), two animation frames painted. Cheap and good enough for screenshots.
 */
export async function settle(page, timeout = 3000) {
  await page.evaluate(async (limit) => {
    await document.fonts.ready
    const deadline = performance.now() + limit
    while (document.getAnimations().length > 0 && performance.now() < deadline) {
      await new Promise((done) => setTimeout(done, 50))
    }
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  }, timeout)
}

/** Screenshot into .artifacts/shots/<name>.png; returns the absolute path. */
export async function shot(page, name) {
  mkdirSync(shotDir, { recursive: true })
  const file = join(shotDir, `${name}.png`)
  // Hidden windows (the default for automated runs) cannot be captured by page.screenshot: ask
  // Electron to capture the window contents instead; that works hidden or visible.
  if (page.electronApp) {
    const base64 = await page.electronApp.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows()
      const appWin = windows.find((w) => !w.webContents.getURL().endsWith('/render.html'))
      const image = await (appWin ?? windows[0]).webContents.capturePage()
      return image.toPNG().toString('base64')
    })
    writeFileSync(file, Buffer.from(base64, 'base64'))
  } else {
    await page.screenshot({ path: file })
  }
  return file
}

let passedChecks = 0
const traceStart = Date.now()

/** Asserts one thing in a flow; throws (failing the flow) with the name and detail when `ok` is false. */
export function check(name, ok, detail = '') {
  if (!ok) throw new Error(`${name}${detail ? ` (${detail})` : ''}`)
  passedChecks++
  if (process.env.E2E_TRACE)
    console.log(
      `  [${((Date.now() - traceStart) / 1000).toFixed(1)}s] ${name}${detail ? ` (${detail})` : ''}`
    )
}

/** Number of checks that passed since the last call; the runner prints it per flow. */
export function takeCheckCount() {
  const count = passedChecks
  passedChecks = 0
  return count
}

/** Polls `read` until `done(value)` (or the deadline); returns the last value. Use instead of fixed sleeps. */
export async function waitUntil(read, done = Boolean, timeout = 15_000, interval = 100) {
  const deadline = Date.now() + timeout
  for (let value = await read(); ; value = await read()) {
    if (done(value) || Date.now() > deadline) return value
    await sleep(interval)
  }
}

/** Calls a module's main-side contract channel from the page: `invoke(page, 'deck-builder', 'listLessons')`. */
export const invoke = (page, moduleId, channel, ...args) =>
  page.evaluate(([m, c, a]) => window.api.modules.invoke(m, c, ...a), [moduleId, channel, args])
