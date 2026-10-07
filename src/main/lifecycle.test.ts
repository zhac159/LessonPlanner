import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelAllJobs, createLifecycle, type JobSource, type LifecycleDeps } from './lifecycle'

function setup(overrides: Partial<LifecycleDeps> = {}) {
  const calls: string[] = []
  const deps: LifecycleDeps = {
    quit: () => calls.push('quit'),
    exit: (code) => calls.push(`exit:${code}`),
    stopInvocations: () => calls.push('stop-calls'),
    cancelJobs: async () => void calls.push('cancel-jobs'),
    deactivateModules: async () => void calls.push('deactivate'),
    disposeServices: async () => void calls.push('services'),
    disposeRenderer: () => void calls.push('render-window'),
    startupSettled: async () => void calls.push('startup-settled'),
    log: { error: () => void calls.push('logged-error') },
    ...overrides
  }
  return { calls, lifecycle: createLifecycle(deps) }
}

/** Mimics Electron: `quit()` emits `before-quit` first, and the quit goes ahead unless it was prevented. */
function electronLike(overrides: Partial<LifecycleDeps> = {}) {
  const calls: string[] = []
  let lifecycle: ReturnType<typeof createLifecycle>
  let quitCompleted = false
  const quit = (): void => {
    calls.push('app.quit')
    let prevented = false
    lifecycle.onBeforeQuit({ preventDefault: () => (prevented = true) })
    if (!prevented) quitCompleted = true
  }
  const made = setup({ quit, ...overrides })
  lifecycle = made.lifecycle
  made.calls.length = 0
  return { ...made, quit, quitCompleted: () => quitCompleted, appCalls: calls }
}

afterEach(() => vi.useRealTimers())

describe('closing the main window', () => {
  it('quits the app: calls stop, jobs are cancelled, modules and the render window shut down, then it quits', async () => {
    const app = electronLike()
    app.lifecycle.requestQuit() // what the main window's "closed" event does
    expect(app.quitCompleted()).toBe(false) // before-quit held the quit while shutting down
    await vi.waitFor(() => expect(app.quitCompleted()).toBe(true))
    expect(app.calls).toEqual([
      'stop-calls',
      'startup-settled',
      'cancel-jobs',
      'deactivate',
      'services',
      'render-window'
    ])
    expect(app.appCalls).toEqual(['app.quit', 'app.quit'])
  })

  it('still quits when a step fails or jobs cannot be cancelled', async () => {
    const app = electronLike({
      cancelJobs: async () => {
        throw new Error('no jobs for you')
      },
      deactivateModules: async () => {
        throw new Error('flush failed')
      }
    })
    app.lifecycle.requestQuit()
    await vi.waitFor(() => expect(app.quitCompleted()).toBe(true))
    expect(app.calls.filter((c) => c === 'logged-error')).toHaveLength(2)
    expect(app.calls).toContain('render-window')
  })

  it('runs the shutdown once however many quits are requested', async () => {
    const deactivate = vi.fn(async () => undefined)
    const app = electronLike({ deactivateModules: deactivate })
    app.lifecycle.requestQuit()
    app.lifecycle.requestQuit()
    app.lifecycle.requestQuit()
    await vi.waitFor(() => expect(app.quitCompleted()).toBe(true))
    expect(deactivate).toHaveBeenCalledTimes(1)
  })

  it('does not wait for a startup that never settles for longer than the limit', async () => {
    vi.useFakeTimers()
    const app = electronLike({
      startupSettled: () => new Promise(() => undefined),
      startupWaitMs: 50
    })
    app.lifecycle.requestQuit()
    await vi.advanceTimersByTimeAsync(60)
    await vi.waitFor(() => expect(app.quitCompleted()).toBe(true))
    expect(app.calls).toContain('deactivate')
  })

  it('exits by force when a step hangs, so no process is left behind', async () => {
    vi.useFakeTimers()
    const app = setup({ deactivateModules: () => new Promise(() => undefined), watchdogMs: 1000 })
    void app.lifecycle.shutdown()
    await vi.advanceTimersByTimeAsync(1001)
    expect(app.calls).toContain('exit:0')
  })

  it('does not fire the watchdog after a clean shutdown', async () => {
    vi.useFakeTimers()
    const app = setup({ watchdogMs: 1000 })
    await app.lifecycle.shutdown()
    await vi.advanceTimersByTimeAsync(5000)
    expect(app.calls).not.toContain('exit:0')
  })
})

describe('failAndExit', () => {
  it('cleans up and exits with code 1 instead of leaving a half-started process', async () => {
    const app = setup()
    await app.lifecycle.failAndExit()
    expect(app.calls.at(-1)).toBe('exit:1')
    expect(app.calls).toContain('deactivate')
  })
})

describe('cancelAllJobs', () => {
  function lessonsWith(running: Record<string, 'generation' | 'chat' | 'plugin'>): {
    source: JobSource
    cancelled: string[]
    finish: () => void
  } {
    const cancelled: string[] = []
    let finish: () => void = () => undefined
    const done = new Promise<void>((resolve) => (finish = resolve))
    const source: JobSource = {
      list: async () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      jobs: {
        running: (id) => (running[id] ? { id: `job-${id}`, done } : undefined),
        cancel: (jobId) => {
          cancelled.push(jobId)
          finish() // a cancelled job winds down
          return true
        }
      }
    }
    return { source, cancelled, finish }
  }

  it('cancels chat and plugin jobs as well as generation, on lessons that are not generating', async () => {
    const { source, cancelled } = lessonsWith({ a: 'generation', b: 'chat', c: 'plugin' })
    await cancelAllJobs(source)
    expect(cancelled).toEqual(['job-a', 'job-b', 'job-c'])
  })

  it('does nothing without services or running jobs', async () => {
    await cancelAllJobs(null)
    const { source, cancelled } = lessonsWith({})
    await cancelAllJobs(source)
    expect(cancelled).toEqual([])
  })

  it('stops waiting for a job that will not settle', async () => {
    vi.useFakeTimers()
    const source: JobSource = {
      list: async () => [{ id: 'a' }],
      jobs: { running: () => ({ id: 'j', done: new Promise(() => undefined) }), cancel: () => true }
    }
    const finished = cancelAllJobs(source, 100)
    await vi.advanceTimersByTimeAsync(101)
    await expect(finished).resolves.toBeUndefined()
  })
})
