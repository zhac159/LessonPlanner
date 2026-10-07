/**
 * The app's start-up and shut-down wiring, with Electron replaced by a fake. A real hidden launch proves the same
 * thing end to end (see agents/CHANGELOG.md); this keeps the rules from regressing without starting Chromium.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (...args: unknown[]) => void

const h = vi.hoisted(() => {
  const state = {
    listeners: new Map<string, Listener[]>(),
    calls: [] as string[],
    quitCompleted: false,
    gotLock: true,
    exitCode: undefined as number | undefined,
    onClosed: undefined as (() => void) | undefined,
    problems: [] as Array<{ title: string; message: string; details: string; severity: string }>,
    dataRoot: (): { root: string; fallbackFrom?: string; problem?: string } => ({
      root: 'C:\\data'
    }),
    seedFails: false,
    focused: 0,
    renderWindowOpen: true
  }
  return state
})

const emit = (event: string, ...args: unknown[]): void =>
  (h.listeners.get(event) ?? []).forEach((listener) => listener(...args))

vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    commandLine: { getSwitchValue: () => '', appendSwitch: () => undefined },
    getAppPath: () => 'C:\\repo',
    setPath: () => undefined,
    setAppUserModelId: () => undefined,
    requestSingleInstanceLock: () => h.gotLock,
    whenReady: () => Promise.resolve(),
    on: (event: string, listener: Listener) => {
      h.listeners.set(event, [...(h.listeners.get(event) ?? []), listener])
    },
    quit: () => {
      h.calls.push('app.quit')
      let prevented = false
      emit('before-quit', { preventDefault: () => (prevented = true) })
      if (!prevented) h.quitCompleted = true
    },
    exit: (code: number) => {
      h.exitCode = code
    }
  }
  const session = {
    defaultSession: {
      setPermissionRequestHandler: () => undefined,
      setPermissionCheckHandler: () => undefined
    }
  }
  return { app, session, Menu: { setApplicationMenu: () => undefined } }
})

vi.mock('./services/paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/paths')>()),
  ensureDataRoot: () => h.dataRoot(),
  setDataRoot: (root: string) => root
}))
vi.mock('./logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))
vi.mock('./ipc', () => ({ registerCoreIpc: () => undefined }))
vi.mock('./dev/hook', () => ({
  seedBeforeModules: async () => {
    if (h.seedFails) throw new Error('seed exploded')
  },
  seedAfterModules: async () => undefined,
  seedAfterWindow: async () => undefined
}))
vi.mock('./modules', () => ({
  loadMainModules: async () => void h.calls.push('modules loaded'),
  deactivateMainModules: async () => void h.calls.push('modules deactivated')
}))
vi.mock('./render', () => ({
  disposeSlideRenderer: () => {
    h.calls.push('render window destroyed')
    h.renderWindowOpen = false
  }
}))
vi.mock('./services/deckBuilder/sharedStyles', () => ({
  disposeSharedStyles: async () => void h.calls.push('styles disposed')
}))
vi.mock('./window', () => ({
  createMainWindow: (options: { onClosed?: () => void }) => {
    h.onClosed = options.onClosed
    h.calls.push('main window created')
  },
  focusMainWindow: () => void h.focused++
}))
vi.mock('./startupProblem', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./startupProblem')>()),
  showProblem: async (problem: (typeof h.problems)[number]) => void h.problems.push(problem)
}))

/** Imports index.ts afresh (it starts the app as a side effect) and lets start-up finish. */
async function launch(prepare?: () => Promise<void>): Promise<void> {
  vi.resetModules()
  await prepare?.()
  await import('./index')
  await vi.waitFor(() =>
    expect(h.listeners.size > 0 || h.exitCode !== undefined || !h.gotLock).toBe(true)
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  h.listeners.clear()
  h.calls.length = 0
  h.problems.length = 0
  h.quitCompleted = false
  h.gotLock = true
  h.exitCode = undefined
  h.onClosed = undefined
  h.seedFails = false
  h.focused = 0
  h.renderWindowOpen = true
  h.dataRoot = () => ({ root: 'C:\\data' })
  vi.stubEnv('CLAUDECODE', '0')
  vi.stubEnv('SLIDE_PLANNER_TEST', '')
})

async function runningJobs(kinds: Record<string, string>): Promise<string[]> {
  const cancelled: string[] = []
  // The same module instance index.ts uses (the registry was reset by `launch`, not since).
  const { setCurrentDeckBuilder } = await import('./services/deckBuilder/current')
  setCurrentDeckBuilder({
    emit: () => undefined,
    services: {
      lessons: {
        list: async () => Object.keys(kinds).map((id) => ({ id })),
        jobs: {
          running: (id: string) => ({ id: `${kinds[id]}-job`, done: Promise.resolve() }),
          cancel: (jobId: string) => {
            h.calls.push(`cancelled ${jobId}`)
            cancelled.push(jobId)
            return true
          }
        }
      }
    }
  } as never)
  return cancelled
}

describe('closing the main window', () => {
  it('quits the whole app even though the hidden render window is still open', async () => {
    await launch()
    expect(h.renderWindowOpen).toBe(true)
    h.onClosed?.() // the main window was closed; the render window is not a window that counts
    await vi.waitFor(() => expect(h.quitCompleted).toBe(true))
    expect(h.renderWindowOpen).toBe(false)
    expect(h.calls).toEqual([
      'modules loaded',
      'main window created',
      'app.quit',
      'modules deactivated',
      'styles disposed',
      'render window destroyed',
      'app.quit'
    ])
  })

  it('cancels generation, chat and plugin jobs first when work is running', async () => {
    await launch()
    const cancelled = await runningJobs({ a: 'generation', b: 'chat', c: 'plugin' })
    h.onClosed?.()
    await vi.waitFor(() => expect(h.quitCompleted).toBe(true))
    expect(cancelled).toEqual(['generation-job', 'chat-job', 'plugin-job'])
    expect(h.calls.indexOf('cancelled plugin-job')).toBeLessThan(
      h.calls.indexOf('modules deactivated')
    )
  })

  it('also quits through window-all-closed, and only shuts down once', async () => {
    await launch()
    emit('window-all-closed')
    emit('window-all-closed')
    h.onClosed?.()
    await vi.waitFor(() => expect(h.quitCompleted).toBe(true))
    expect(h.calls.filter((c) => c === 'modules deactivated')).toHaveLength(1)
  })
})

describe('a second launch', () => {
  it("shows the existing window for the owner's launch, also one that was hidden for automation", async () => {
    await launch()
    emit('second-instance', {}, ['C:\\Apps\\Slide Planner.exe'])
    expect(h.focused).toBe(1)
  })

  it("leaves it alone for a script's launch", async () => {
    await launch()
    emit('second-instance', {}, ['x.exe', '--slide-planner-automation'])
    emit('second-instance', {}, ['x.exe', '--remote-debugging-pipe'])
    expect(h.focused).toBe(0)
  })

  it('quits at once when another instance holds the lock, starting nothing', async () => {
    h.gotLock = false
    await launch()
    expect(h.calls).toEqual(['app.quit'])
  })
})

describe('the data folder cannot be used', () => {
  it('explains it in plain English and exits instead of crashing or staying invisible', async () => {
    await launch(async () => {
      const { DataFolderError } = await import('./services/paths')
      h.dataRoot = () => {
        throw new DataFolderError('C:\\Program Files\\Slide Planner\\data', 'EACCES', false)
      }
    })
    await vi.waitFor(() => expect(h.exitCode).toBe(1))
    expect(h.problems).toHaveLength(1)
    expect(h.problems[0].message).toContain(
      'Slide Planner can’t save your lessons in C:\\Program Files\\Slide Planner\\data'
    )
    expect(h.problems[0].details).toContain('EACCES')
    expect(h.calls).not.toContain('main window created')
  })

  it('tells the teacher once when a per-user folder is used instead, and starts normally', async () => {
    h.dataRoot = () => ({
      root: 'C:\\Users\\t\\AppData\\Local\\Slide Planner\\data',
      fallbackFrom: 'C:\\Apps\\Slide Planner\\data',
      problem: 'EACCES'
    })
    await launch()
    await vi.waitFor(() => expect(h.problems).toHaveLength(1))
    expect(h.problems[0].severity).toBe('warning')
    expect(h.problems[0].message).toContain('C:\\Apps\\Slide Planner\\data')
    expect(h.calls).toContain('main window created')
    expect(h.exitCode).toBeUndefined()
  })

  it('does not open a dialog in an automated run (nobody can click it), but still exits', async () => {
    vi.stubEnv('CLAUDECODE', '1')
    await launch(async () => {
      const { DataFolderError } = await import('./services/paths')
      h.dataRoot = () => {
        throw new DataFolderError('E:\\x', 'EPERM', true)
      }
    })
    await vi.waitFor(() => expect(h.exitCode).toBe(1))
    expect(h.problems).toHaveLength(0)
  })
})

describe('start-up fails', () => {
  it('shows the plain dialog with the technical text behind "Show details", then exits', async () => {
    h.seedFails = true
    await launch()
    await vi.waitFor(() => expect(h.exitCode).toBe(1))
    expect(h.problems).toHaveLength(1)
    expect(h.problems[0].message).toContain('Something went wrong while Slide Planner was starting')
    expect(h.problems[0].message).not.toContain('seed exploded')
    expect(h.problems[0].details).toContain('seed exploded')
    expect(h.calls).toContain('modules deactivated') // cleaned up on the way out
  })
})
