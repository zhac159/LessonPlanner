import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { AssetFilterId } from '@shared/assets/library'
import type { AssetFrom, AssetPage, AssetSummary, AssetsEvents } from '@shared/contracts/assets'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_LOAD } from '../model/messages'
import { useDebounced } from './useDebounced'

export const PAGE_SIZE = 60

export interface LibraryFilters {
  search: string
  filter: AssetFilterId
  from: AssetFrom
}

export interface Library {
  /** The first page's answer (counts, froms, banner); null while loading. */
  page: AssetPage | null
  /** Every card loaded so far (pages of 60). */
  items: AssetSummary[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  loadingMore: boolean
  reload(): void
  loadMore(): void
}

/**
 * The library for A1 and A8: the filtered, searched list, kept live. Search waits 150 ms after the last key;
 * `assets:changed` and `assets:review:changed` (the banner) and coming back to the page refresh it.
 */
export function useLibrary({ search, filter, from }: LibraryFilters, active: boolean): Library {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const wanted = useDebounced(search.trim(), 150)
  const [page, setPage] = useState<AssetPage | null>(null)
  const [items, setItems] = useState<AssetSummary[]>([])
  const [status, setStatus] = useState<Library['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [version, setVersion] = useState(0)
  const cursor = useRef<string | null>(null)
  const latest = useRef(0)

  const reload = useCallback(() => setVersion((n) => n + 1), [])

  useEffect(() => {
    const ticket = ++latest.current
    client
      .list({ search: wanted || undefined, filter, from, limit: PAGE_SIZE })
      .then((answer) => {
        if (ticket !== latest.current) return
        cursor.current = answer.cursor
        setPage(answer)
        setItems(answer.items)
        setStatus('ready')
        setError(null)
      })
      .catch(() => {
        if (ticket !== latest.current) return
        setStatus((s) => (s === 'ready' ? s : 'error'))
        setError(COULDNT_LOAD)
      })
  }, [client, wanted, filter, from, version])

  // Coming back to the page reads the library again (the first look already did).
  const wasActive = useRef(active)
  useEffect(() => {
    if (active && !wasActive.current) reload()
    wasActive.current = active
  }, [active, reload])

  useEvent<AssetsEvents, 'changed'>(MODULE_ID, 'changed', reload)
  useEvent<AssetsEvents, 'review:changed'>(MODULE_ID, 'review:changed', reload)

  const loadMore = useCallback(() => {
    const next = cursor.current
    if (!next || loadingMore) return
    const ticket = latest.current
    setLoadingMore(true)
    client
      .list({ search: wanted || undefined, filter, from, limit: PAGE_SIZE, cursor: next })
      .then((answer) => {
        if (ticket !== latest.current) return
        cursor.current = answer.cursor
        setItems((current) => [...current, ...answer.items])
      })
      .catch(() => setError(COULDNT_LOAD))
      .finally(() => setLoadingMore(false))
  }, [client, wanted, filter, from, loadingMore])

  return { page, items, status, error, loadingMore, reload, loadMore }
}
