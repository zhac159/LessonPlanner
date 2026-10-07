import { app, Menu, session } from 'electron'
import { homedir } from 'node:os'
import { APP_CONFIG } from '@shared/appConfig'
import { isAutomatedLaunch, resolveAutomation } from './automation'
import { seedAfterModules, seedAfterWindow, seedBeforeModules } from './dev/hook'
import { registerCoreIpc } from './ipc'
import { cancelAllJobs, createLifecycle } from './lifecycle'
import { createLogger } from './logger'
import { holdInvocationsUntil, refuseInvocations } from './moduleBus'
import { deactivateMainModules, loadMainModules } from './modules'
import { disposeSlideRenderer } from './render'
import { getCurrentDeckBuilder } from './services/deckBuilder/current'
import { disposeSharedStyles } from './services/deckBuilder/sharedStyles'
import { ensureDataRoot, setDataRoot } from './services/paths'
import { dataFolderNotice, describeProblem, showProblem, type Problem } from './startupProblem'
import { createMainWindow, focusMainWindow } from './window'

const log = createLogger('main')

/** A script cannot click a dialog: automated runs only log (a packaged build needs the explicit unlock, see automation.ts). */
const automated = resolveAutomation({
  env: process.env,
  argv: process.argv,
  isPackaged: app.isPackaged
}).automated

/** Settles when `start()` has finished or failed. A quit that arrives meanwhile waits for it (see lifecycle.ts). */
let startup: Promise<unknown> = Promise.resolve()
let started = false
let failing = false
/** Shown once the app is up: the default data folder was read-only and the per-user folder is used instead. */
let startupNotice: Problem | undefined

const lifecycle = createLifecycle({
  quit: () => app.quit(),
  exit: (code) => app.exit(code),
  stopInvocations: () => refuseInvocations('Slide Planner is closing.'),
  // Every running job, not only generation: chat turns and plugin runs too (the services only know "generating").
  cancelJobs: () => cancelAllJobs(getCurrentDeckBuilder()?.services.lessons),
  deactivateModules: deactivateMainModules,
  disposeServices: disposeSharedStyles,
  disposeRenderer: disposeSlideRenderer,
  startupSettled: () => startup.catch(() => undefined),
  log
})

async function report(problem: Problem): Promise<void> {
  log.error(`${problem.title}: ${problem.message}`, problem.details)
  if (automated) return
  try {
    await showProblem(problem)
  } catch (error) {
    log.error('Could not show the problem dialog:', error)
  }
}

/** Startup failed for good: say so in plain English (details on request), clean up, exit. Never an invisible process. */
async function fatal(error: unknown): Promise<void> {
  if (failing) return
  failing = true
  await report(describeProblem(error))
  await lifecycle.failAndExit()
}

async function start(): Promise<void> {
  app.setAppUserModelId(APP_CONFIG.appId)
  Menu.setApplicationMenu(null)

  // The renderer is sandboxed and offline by design; features that need a permission
  // (camera, notifications, ...) should be added deliberately, not granted by default.
  // The one exception: writing to the clipboard (copy buttons), which cannot read anything back.
  const allowed = (permission: string): boolean => permission === 'clipboard-sanitized-write'
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) =>
    callback(allowed(permission))
  )
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    allowed(permission)
  )

  registerCoreIpc()
  await seedBeforeModules() // dev only: SLIDE_PLANNER_SEED, ignored when packaged
  // The window (and the splash it shows) opens while the modules activate; calls from its page wait for them.
  const modules = loadMainModules()
  holdInvocationsUntil(modules)
  // Closing the main window always ends the app: the hidden render window must not keep it alive.
  createMainWindow({ onClosed: () => lifecycle.requestQuit() })
  if (startupNotice) void report(startupNotice)
  await modules
  await seedAfterModules()
  void seedAfterWindow()
  started = true
}

/**
 * Everything the app stores lives in one data folder (see services/paths.ts). Chromium's own
 * userData follows it, unless the caller chose one with --user-data-dir. Must run before the
 * single-instance lock, which is keyed on userData. Throws a `DataFolderError` when no folder can be used.
 */
function setUpDataRoot(): void {
  const userDataSwitch = app.commandLine.getSwitchValue('user-data-dir')
  const choice = ensureDataRoot({
    env: process.env,
    userDataSwitch,
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    appPath: app.getAppPath(),
    homeDir: homedir()
  })
  const root = setDataRoot(choice.root, choice.fallbackFrom)
  if (!userDataSwitch) app.setPath('userData', root)
  if (choice.fallbackFrom) {
    startupNotice = dataFolderNotice(choice.fallbackFrom, root, choice.problem ?? '')
  }
}

// The app is offline and loads only local files, so Chromium's separate network process is dead weight:
// run it inside the browser process (one process and ~80 MB less at idle). Must be set before `ready`.
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess2')

let dataRootError: unknown
try {
  setUpDataRoot()
} catch (error) {
  dataRootError = error
}

if (dataRootError) {
  // Without a data folder there is nothing to run: explain, then leave (dialogs need `ready`).
  // (not stored in `startup`: the shutdown would wait for the very promise that runs it)
  app
    .whenReady()
    .then(() => fatal(dataRootError))
    .catch((error) => {
      log.error('Could not report the startup problem:', error)
      app.exit(1)
    })
} else if (!app.requestSingleInstanceLock()) {
  // One running instance at a time: a second launch just brings the first window forward.
  app.quit()
} else {
  // A second launch by the owner shows the window even when it was hidden for automation; a script's second launch does not.
  app.on('second-instance', (_event, argv) => {
    if (!isAutomatedLaunch(argv)) focusMainWindow()
  })
  app.on('window-all-closed', () => lifecycle.requestQuit())
  // The shutdown is async (cancel jobs, flush files): hold the quit until it is done (see lifecycle.ts).
  app.on('before-quit', (event) => lifecycle.onBeforeQuit(event))

  // Until the app is up, an uncaught error ends in the same plain dialog instead of a half-started process.
  const onUncaught = (error: Error): void => {
    log.error('Uncaught exception:', error)
    if (!started) void fatal(error)
  }
  process.on('uncaughtException', onUncaught)

  startup = app
    .whenReady()
    .then(start)
    .finally(() => process.off('uncaughtException', onUncaught))
  startup.catch((error) => {
    log.error('Startup failed:', error)
    void fatal(error)
  })
}
