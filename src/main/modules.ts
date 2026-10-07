import { errorMessage, loadModules } from '@shared/registry'
import { emitModuleEvent, registerHandler, removeModuleHandlers } from './moduleBus'
import { createLogger } from './logger'
import { moduleDataDir } from './services/paths'
import type { MainModule, MainModuleContext } from './sdk'

const log = createLogger('modules')

const ACTIVATE_TIMEOUT_MS = 5000

/**
 * Every src/modules/<id>/main.ts is discovered here, with no registry to edit.
 * A folder starting with "_" is ignored, which is the easy way to switch a module off.
 */
const loaders = import.meta.glob(['../modules/*/main.ts', '!../modules/_*/main.ts'])

const active: MainModule[] = []

interface ModuleContextHandle {
  context: MainModuleContext
  /** Called when activation failed or timed out: from then on `ctx.handle` refuses to register anything. */
  dispose(): void
}

function createContext(id: string): ModuleContextHandle {
  const moduleLog = createLogger(`module:${id}`)
  let dataDir: string | undefined
  let disposed = false
  const context: MainModuleContext = {
    id,
    log: moduleLog,
    get dataDir(): string {
      dataDir ??= moduleDataDir(id)
      return dataDir
    },
    handle: (channel, handler) => {
      // A module that timed out may still be running; it must not register handlers after being removed.
      if (disposed)
        throw new Error(`Module "${id}" failed to activate and can no longer register handlers`)
      registerHandler(id, channel, handler as (...args: unknown[]) => unknown)
    },
    emit: (channel, payload) => {
      if (!disposed) emitModuleEvent(id, channel, payload)
    }
  }
  return {
    context,
    dispose: () => {
      disposed = true
    }
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Discover and activate all main-process modules. Never throws: a broken module is logged and skipped. */
export async function loadMainModules(): Promise<void> {
  const { modules, issues } = await loadModules<MainModule>(loaders, { kind: 'main' })
  for (const issue of issues)
    log.error(`Skipped "${issue.moduleId}" (${issue.path}): ${issue.message}`)

  for (const module of modules) {
    const { context, dispose } = createContext(module.id)
    try {
      await withTimeout(
        Promise.resolve().then(() => module.activate(context)),
        ACTIVATE_TIMEOUT_MS,
        `${module.id}.activate()`
      )
      active.push(module)
      log.info(`Activated "${module.id}"`)
    } catch (error) {
      dispose()
      removeModuleHandlers(module.id)
      log.error(`Failed to activate "${module.id}": ${errorMessage(error)}`)
    }
  }
}

/** Calls deactivate() on every module that activated. Each gets ACTIVATE_TIMEOUT_MS before we move on. */
export async function deactivateMainModules(): Promise<void> {
  for (const module of active.splice(0)) {
    try {
      await withTimeout(
        Promise.resolve().then(() => module.deactivate?.()),
        ACTIVATE_TIMEOUT_MS,
        `${module.id}.deactivate()`
      )
    } catch (error) {
      log.error(`Failed to deactivate "${module.id}": ${errorMessage(error)}`)
    }
  }
}
