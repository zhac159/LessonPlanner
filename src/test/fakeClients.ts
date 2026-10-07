/**
 * Fake module clients for tests. See `renderWithApp` in ./render.tsx for the usual entry point.
 *
 *   const settings = fakeClient<SettingsApi>({ getProfile: () => ok({ profile }) })
 *   const clients = createFakeClients({ settings })
 *   clients.emit('deck-builder', 'job:progress', { done: 1 })    // drive useEvent subscribers
 *
 * Every method is a `vi.fn`, so `expect(settings.getProfile).toHaveBeenCalled()` works.
 * A method the test did not implement rejects with a clear error instead of returning undefined.
 */
import { vi } from 'vitest'
import type { ContractClient, ContractImpl } from '@shared/contract'
import type { Clients } from '@renderer/core/ClientsContext'

export interface FakeClients extends Clients {
  /** Deliver an event to everything subscribed with `useEvent`. */
  emit(moduleId: string, event: string, payload?: unknown): void
}

/** A typed client backed by `impl`. Methods return promises (sync results and throws are wrapped). */
export function fakeClient<C>(impl: Partial<ContractImpl<C>> = {}): ContractClient<C> {
  const source = impl as Record<string, unknown>
  const methods = new Map<string, unknown>()
  return new Proxy({} as ContractClient<C>, {
    get(_target, name) {
      if (typeof name !== 'string' || name === 'then') return undefined
      let method = methods.get(name)
      if (!method) {
        const target = source[name]
        method = vi.fn(async (...args: unknown[]) => {
          if (typeof target !== 'function') {
            throw new Error(`fakeClient: "${name}" was called but the test did not implement it`)
          }
          return target.apply(source, args)
        })
        methods.set(name, method)
      }
      return method
    }
  })
}

/** Clients for several modules: `{ settings: fakeClient<SettingsApi>(...) }`. Unlisted modules reject every call. */
export function createFakeClients(clients: Record<string, object> = {}): FakeClients {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  const fallbacks = new Map<string, object>()
  const key = (moduleId: string, event: string): string => `${moduleId}:${event}`
  return {
    client<C>(moduleId: string): ContractClient<C> {
      if (clients[moduleId]) return clients[moduleId] as ContractClient<C>
      if (!fallbacks.has(moduleId)) fallbacks.set(moduleId, fakeClient())
      return fallbacks.get(moduleId) as ContractClient<C>
    },
    subscribe(moduleId, event, listener) {
      const set = listeners.get(key(moduleId, event)) ?? new Set()
      listeners.set(key(moduleId, event), set)
      set.add(listener)
      return () => set.delete(listener)
    },
    emit(moduleId, event, payload) {
      listeners.get(key(moduleId, event))?.forEach((listener) => listener(payload))
    }
  }
}
