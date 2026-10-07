/**
 * Typed IPC contracts. Describe a module's main-process API ONCE as an interface of methods; the
 * main side implements it with `serveContract` (@main/sdk) and any renderer code calls it through a
 * typed client from `useClient` / `contractClient` (@renderer/sdk). No channel strings, no casts, and
 * trivially fakeable in component tests.
 *
 *   // src/shared/contracts/example.ts
 *   export interface ExampleApi { greet(name: string): Result<{ text: string }>; 'jobs:cancel'(id: string): void }
 *   export interface ExampleEvents { 'example:progress': { done: number; total: number } }
 *   export const EXAMPLE = 'example' as const            // the module id that serves it
 *
 * Pure TypeScript: no Node, Electron or DOM imports.
 */

/** An interface whose members are all functions: the request/response API of one module. */
export type ContractShape = { [method: string]: (...args: never[]) => unknown }

/** What the renderer sees: every method returns a Promise. */
export type ContractClient<C> = {
  [K in keyof C]: C[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

/** What the main process implements: sync or async. */
export type ContractImpl<C> = {
  [K in keyof C]: C[K] extends (...args: infer A) => infer R ? (...args: A) => R | Promise<R> : never
}

/** Event name -> payload type, for push messages from main to renderer. */
export type EventMap = { [event: string]: unknown }
