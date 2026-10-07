import { createContext, useContext, type ReactNode } from 'react'
import type { ContractClient } from '@shared/contract'
import type { PlanningApi } from '@shared/api'
import { contractClient } from './contractClient'
import { createModuleApi } from './createModuleApi'

/**
 * How UI code reaches ANY module's main-process half: typed clients and event subscriptions.
 * The default implementation uses `window.api.modules`; tests provide fakes (`@test/render`).
 */
export interface Clients {
  /** A stable typed client for the contract served by `moduleId`. */
  client<C>(moduleId: string): ContractClient<C>
  /** Listen to an event a module emitted with `ctx.emit`. Returns an unsubscribe function. */
  subscribe(moduleId: string, event: string, listener: (payload: unknown) => void): () => void
}

/** Clients backed by a module bridge. `bridge` is read on every call, so `window.api` may be installed late. */
export function createClients(
  bridge: () => PlanningApi['modules'] = () => window.api.modules
): Clients {
  const cache = new Map<string, unknown>()
  return {
    client<C>(moduleId: string): ContractClient<C> {
      let client = cache.get(moduleId)
      if (!client) {
        client = contractClient<C>(createModuleApi(moduleId, bridge))
        cache.set(moduleId, client)
      }
      return client as ContractClient<C>
    },
    subscribe: (moduleId, event, listener) => bridge().on(moduleId, event, listener)
  }
}

const defaultClients = createClients()

export const ClientsContext = createContext<Clients>(defaultClients)

/** Replace the clients for a subtree (tests, or a shell with a different bridge). */
export function ClientsProvider({ clients, children }: { clients: Clients; children: ReactNode }) {
  return <ClientsContext.Provider value={clients}>{children}</ClientsContext.Provider>
}

export function useClients(): Clients {
  return useContext(ClientsContext)
}
