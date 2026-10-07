import type { ContractClient } from '@shared/contract'
import type { ModuleApi } from './types'

/**
 * A typed client for a contract: `client.method(...args)` calls `api.invoke('method', ...args)`.
 * The result is a Proxy, so it works for any contract without listing its methods; it is not
 * thenable (`await client` is the client), and symbols and `then` are never treated as methods.
 */
export function contractClient<C>(api: Pick<ModuleApi, 'invoke'>): ContractClient<C> {
  const methods = new Map<string, unknown>()
  return new Proxy({} as ContractClient<C>, {
    get(_target, name) {
      if (typeof name !== 'string' || name === 'then') return undefined
      let method = methods.get(name)
      if (!method) {
        method = (...args: unknown[]) => api.invoke(name, ...args)
        methods.set(name, method)
      }
      return method
    },
    has: (_target, name) => typeof name === 'string' && name !== 'then'
  })
}
