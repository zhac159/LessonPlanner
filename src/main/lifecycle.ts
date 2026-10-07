/**
 * Quitting the app, in one place (injected, so it is unit-tested without Electron).
 *
 * Why it exists: the hidden slide-render window is a BrowserWindow too, so Electron never fired
 * `window-all-closed` after the teacher closed the main window and the app lived on, invisible, holding the
 * single-instance lock (the next launch then silently did nothing). Closing the MAIN window now always runs
 * `shutdown()` and quits, whatever else is open and whatever is still running.
 *
 * Order: refuse new calls from the page, cancel every running AI job (generation, chat and plugins), let the
 * modules deactivate (they flush files and thumbnails, which still need the render window), then close the
 * render window and quit. A watchdog exits the process if a step hangs: the app must never linger.
 */

export interface LifecycleDeps {
  /** `app.quit()`; calling it more than once is fine. */
  quit(): void
  /** `app.exit(code)`: leaves at once, without `before-quit`. */
  exit(code: number): void
  /** Stops answering calls from the page ("the app is closing"). */
  stopInvocations(): void
  /** Cancels every running job and waits briefly for them to wind down. */
  cancelJobs(): Promise<void>
  deactivateModules(): Promise<void>
  disposeServices(): Promise<void>
  /** Destroys the hidden render window. */
  disposeRenderer(): void
  /** Settles when startup has finished or failed (never rejects). A late quit must not race module activation. */
  startupSettled(): Promise<unknown>
  log: { error(...args: unknown[]): void }
  /** Longest wait for startup to settle; default 5 s. */
  startupWaitMs?: number
  /** After this long the process exits no matter what; default 20 s. */
  watchdogMs?: number
}

export interface Lifecycle {
  /** The main window was closed (or the last window): quit the whole app. */
  requestQuit(): void
  /** Wire to `app.on('before-quit')`: holds the quit until `shutdown()` is done, then quits again. */
  onBeforeQuit(event: { preventDefault(): void }): void
  /** Runs the shutdown steps once; later calls share the same run. */
  shutdown(): Promise<void>
  /** Startup failed for good: shut down and exit with code 1. */
  failAndExit(): Promise<void>
}

/** Resolves with `work`, or after `ms` whichever comes first; the timer never outlives the call. */
async function within(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, ms)))
  try {
    await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export function createLifecycle(deps: LifecycleDeps): Lifecycle {
  let running: Promise<void> | undefined
  let finished = false

  const step = async (name: string, work: () => unknown): Promise<void> => {
    try {
      await work()
    } catch (error) {
      deps.log.error(`Shutdown step "${name}" failed:`, error)
    }
  }

  const shutdown = (): Promise<void> => {
    running ??= (async () => {
      const watchdog = setTimeout(() => deps.exit(0), deps.watchdogMs ?? 20_000)
      watchdog.unref?.()
      try {
        await step('stop calls', () => deps.stopInvocations())
        await within(deps.startupSettled(), deps.startupWaitMs ?? 5000)
        await step('cancel jobs', () => deps.cancelJobs())
        await step('deactivate modules', () => deps.deactivateModules())
        await step('dispose services', () => deps.disposeServices())
        await step('close render window', () => deps.disposeRenderer())
      } finally {
        clearTimeout(watchdog)
        finished = true
      }
    })()
    return running
  }

  return {
    requestQuit: () => deps.quit(),
    onBeforeQuit(event) {
      if (finished) return // shutdown is done: let this quit go through
      event.preventDefault()
      void shutdown().finally(() => deps.quit())
    },
    shutdown,
    failAndExit: () => shutdown().finally(() => deps.exit(1))
  }
}

/** The part of the lesson service the shutdown needs; the real one is `getCurrentDeckBuilder()?.services.lessons`. */
export interface JobSource {
  list(): Promise<ReadonlyArray<{ id: string }>>
  jobs: {
    running(lessonId: string): { id: string; done: Promise<unknown> } | undefined
    cancel(jobId: string): boolean
  }
}

/**
 * Cancels the running job of EVERY lesson, whatever its kind (generation, chat turn, plugin run), then waits up to
 * `settleMs` for them to finish. The services' own `dispose()` only looks at lessons that are "generating".
 */
export async function cancelAllJobs(
  lessons: JobSource | null | undefined,
  settleMs = 3000
): Promise<void> {
  if (!lessons) return
  const settled: Promise<unknown>[] = []
  for (const { id } of await lessons.list()) {
    const job = lessons.jobs.running(id)
    if (!job) continue
    lessons.jobs.cancel(job.id)
    settled.push(job.done)
  }
  if (settled.length > 0) await within(Promise.all(settled), settleMs)
}
