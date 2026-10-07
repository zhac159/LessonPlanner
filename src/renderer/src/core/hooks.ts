import { useEffect, useRef } from 'react'
import type { ContractClient } from '@shared/contract'
import { useClients } from './ClientsContext'

/** A stable typed client for the module that serves contract `C`. Works for any module id. */
export function useClient<C>(moduleId: string): ContractClient<C> {
  return useClients().client<C>(moduleId)
}

/**
 * Subscribe to a module's push event for as long as the component is mounted. The latest
 * `handler` is always called, so callers need not memoise it.
 *
 *   useEvent<ExampleEvents>('example', 'example:progress', (p) => setDone(p.done))
 */
export function useEvent<E, K extends keyof E & string = keyof E & string>(
  moduleId: string,
  event: K,
  handler: (payload: E[K]) => void
): void {
  const clients = useClients()
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(
    () => clients.subscribe(moduleId, event, (payload) => latest.current(payload as E[K])),
    [clients, moduleId, event]
  )
}
