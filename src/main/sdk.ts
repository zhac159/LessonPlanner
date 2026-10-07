/**
 * The API surface for main-process module entries (src/modules/<id>/main.ts).
 * Modules should import from here and from '@shared/*' only, never from other main internals.
 */
import type { ContractImpl } from '@shared/contract'
import type { Logger } from './logger'

export type { Logger }

export interface MainModuleContext {
  /** The module id (equals its folder name). */
  readonly id: string
  /** A private persistent folder for this module, `<dataRoot>/modules/<id>`. Created on first access. */
  readonly dataDir: string
  /**
   * Register a request handler the renderer can call with `api.invoke(channel, ...args)`.
   * Arguments come from the renderer: validate them. Return values must be structured-clonable.
   * Throwing rejects the renderer's promise with the error message.
   */
  handle<Args extends unknown[], Result>(
    channel: string,
    handler: (...args: Args) => Result | Promise<Result>
  ): void
  /** Push an event to the renderer; listen with `api.on(channel, listener)`. */
  emit(channel: string, payload?: unknown): void
  readonly log: Logger
}

export interface MainModule {
  /** Must equal the module's folder name (lowercase kebab-case). */
  id: string
  /** Called once at startup, before the window opens. Register handlers here. Keep it fast (5 s limit). */
  activate(context: MainModuleContext): void | Promise<void>
  /** Called when the app is quitting. */
  deactivate?(): void | Promise<void>
}

/** Identity helper that types a module definition. Default-export the result from main.ts. */
export function defineMainModule(module: MainModule): MainModule {
  return module
}

/**
 * Serve a typed contract (see `@shared/contract`): every own method of `impl` becomes a handler
 * named after the method, called with `this` bound to `impl`. Pair it with `useClient<C>(id)` in
 * the renderer.
 *
 *   serveContract<ExampleApi>(ctx, { greet: (name) => ok({ text: `Hi ${name}` }) })
 *
 * Only own properties count (object literals); inherited helpers on a class are not exposed.
 */
export function serveContract<C>(
  ctx: Pick<MainModuleContext, 'handle'>,
  impl: ContractImpl<C>
): void {
  for (const [name, member] of Object.entries(impl as Record<string, unknown>)) {
    if (typeof member !== 'function') continue
    ctx.handle(name, (...args: unknown[]) => member.apply(impl, args))
  }
}
