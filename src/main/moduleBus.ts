import { IPC } from '@shared/ipc'
import type { InvokeResult, ModuleEventMessage } from '@shared/api'
import { errorMessage, MODULE_ID_PATTERN } from '@shared/registry'
import { createLogger } from './logger'
import { getMainWindow } from './window'

const log = createLogger('bus')

type Handler = (...args: unknown[]) => unknown

/** Handlers registered by main-process modules, keyed by `${moduleId}:${channel}`. */
const handlers = new Map<string, Handler>()

const CHANNEL_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]*$/
const MAX_CHANNEL_LENGTH = 128
/** No contract method takes anywhere near this many arguments; a page that sends more is broken or hostile. */
const MAX_ARGS = 32

const handlerKey = (moduleId: string, channel: string): string => `${moduleId}:${channel}`

export function registerHandler(moduleId: string, channel: string, handler: Handler): void {
  if (!CHANNEL_PATTERN.test(channel) || channel.length > MAX_CHANNEL_LENGTH) {
    throw new Error(`Invalid channel name "${channel}" (letters, digits, ':', '.', '_', '-')`)
  }
  const key = handlerKey(moduleId, channel)
  if (handlers.has(key)) {
    throw new Error(`Module "${moduleId}" already has a handler for "${channel}"`)
  }
  handlers.set(key, handler)
}

/** Used when a module fails to activate, so a half-registered module leaves nothing behind. */
export function removeModuleHandlers(moduleId: string): void {
  const prefix = `${moduleId}:`
  for (const key of handlers.keys()) {
    if (key.startsWith(prefix)) handlers.delete(key)
  }
}

/**
 * Calls from the renderer wait for this before looking for a handler. Startup opens the window while the
 * modules are still activating (the page takes longer to load than that), and a call that arrives early must
 * not be told "no handler".
 */
let modulesStarting: Promise<unknown> = Promise.resolve()

export function holdInvocationsUntil(ready: Promise<unknown>): void {
  modulesStarting = ready.catch(() => undefined)
}

let refusal: string | undefined

/** From now on every call from the page is answered with an error (the app is closing: no new work may start). */
export function refuseInvocations(message: string): void {
  refusal = message
}

/** What is wrong with a call's address or arguments (they come from the page and cannot be trusted), if anything. */
function invalidCall(moduleId: unknown, channel: unknown, args: unknown): string | undefined {
  if (typeof moduleId !== 'string' || !MODULE_ID_PATTERN.test(moduleId) || moduleId.length > 64) {
    return 'Invalid module id'
  }
  if (
    typeof channel !== 'string' ||
    !CHANNEL_PATTERN.test(channel) ||
    channel.length > MAX_CHANNEL_LENGTH
  ) {
    return 'Invalid channel name'
  }
  if (!Array.isArray(args) || args.length > MAX_ARGS) return 'Invalid arguments'
  return undefined
}

/** Only registered handlers can be reached from the renderer; everything else is an error result. */
export async function invokeHandler(
  moduleId: string,
  channel: string,
  args: unknown[]
): Promise<InvokeResult> {
  const invalid = invalidCall(moduleId, channel, args)
  if (invalid) return { ok: false, error: invalid }
  if (refusal) return { ok: false, error: refusal }
  await modulesStarting
  if (refusal) return { ok: false, error: refusal }
  const handler = handlers.get(handlerKey(moduleId, channel))
  if (!handler) {
    return { ok: false, error: `No handler "${channel}" registered by module "${moduleId}"` }
  }
  try {
    return { ok: true, value: await handler(...args) }
  } catch (error) {
    log.error(`${moduleId}:${channel} failed:`, error)
    return { ok: false, error: errorMessage(error) }
  }
}

export function emitModuleEvent(moduleId: string, channel: string, payload: unknown): void {
  const win = getMainWindow()
  if (!win) return
  const message: ModuleEventMessage = { moduleId, channel, payload }
  win.webContents.send(IPC.modules.event, message)
}
