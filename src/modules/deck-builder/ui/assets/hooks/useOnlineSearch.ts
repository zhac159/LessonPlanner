import { useCallback, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { ASSETS, type AssetsApi, type OnlineResult } from '@shared/contracts/assets'

export type OnlineState =
  | { status: 'idle'; results: OnlineResult[]; total: number }
  | { status: 'searching'; results: OnlineResult[]; total: number }
  | { status: 'done'; results: OnlineResult[]; total: number }
  | { status: 'error'; results: OnlineResult[]; total: number; message: string }

/** The same search is not asked twice within ten minutes (agents/ASSETS.md §3.13 step 1). */
export const ONLINE_CACHE_MS = 10 * 60 * 1000

interface Cached {
  at: number
  results: OnlineResult[]
  total: number
}
const cache = new Map<string, Cached>()

/** Forgets cached searches (tests). */
export const clearOnlineCache = (): void => cache.clear()

/** "Find online" inside the editor: free images for a spot, searched once per query and kept for ten minutes. */
export function useOnlineSearch(freeToUse = true) {
  const client = useClient<AssetsApi>(ASSETS)
  const [state, setState] = useState<OnlineState>({ status: 'idle', results: [], total: 0 })
  const issued = useRef(0)

  const search = useCallback(
    async (query: string): Promise<void> => {
      const text = query.trim()
      if (!text) return
      issued.current += 1
      const mine = issued.current
      const key = `${text.toLowerCase()}|${freeToUse}`
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < ONLINE_CACHE_MS) {
        return setState({ status: 'done', results: hit.results, total: hit.total })
      }
      setState((was) => ({ ...was, status: 'searching' }))
      try {
        const answer = await client['online:search']({
          query: text,
          kind: 'any',
          freeToUse,
          page: 1
        })
        if (mine !== issued.current) return
        if (!answer.ok) {
          return setState({ status: 'error', results: [], total: 0, message: answer.message })
        }
        cache.set(key, { at: Date.now(), results: answer.results, total: answer.total })
        setState({ status: 'done', results: answer.results, total: answer.total })
      } catch {
        if (mine !== issued.current) return
        setState({
          status: 'error',
          results: [],
          total: 0,
          message: 'Couldn’t search just now. Check your internet connection and try again.'
        })
      }
    },
    [client, freeToUse]
  )
  return { state, search }
}
