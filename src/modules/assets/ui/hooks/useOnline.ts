import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import type { OnlineKindFilter, OnlineResult, OnlineSearchResult } from '@shared/contracts/assets'
import { useToast } from '@ui/overlays'
import { PROVIDER_LABELS } from '@ui/assets'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_SAVE } from '../model/messages'
import { useDebounced } from './useDebounced'

/** Up to five pages of 24 (agents/ASSETS.md §3.9). */
export const MAX_ONLINE_PAGES = 5

export interface OnlineState {
  query: string
  setQuery(query: string): void
  kind: OnlineKindFilter
  setKind(kind: OnlineKindFilter): void
  freeToUse: boolean
  setFreeToUse(on: boolean): void
  /** idle = nothing searched yet. */
  status: 'idle' | 'busy' | 'ready' | 'error'
  /** The message that goes with `error`. */
  error: string | null
  /** The query that produced `results` (for "Nothing found for “…”"). */
  searched: string
  results: OnlineResult[]
  total: number | null
  hasMore: boolean
  loadingMore: boolean
  /** "{Openverse} didn't answer. Showing the others." */
  providerNote: string | null
  selected: OnlineResult | null
  select(id: string): void
  checked: ReadonlySet<string>
  toggle(id: string, on: boolean): void
  clearChecked(): void
  name: string
  setName(name: string): void
  nameError: string | undefined
  adding: boolean
  search(): void
  more(): void
  /** "Add to Your assets" in the pane: saves that one now. */
  addSelected(): Promise<void>
  /** "Add n to Your assets": opens a review batch (resolves its id, or null on a failure). */
  addChecked(): Promise<string | null>
}

/** A9: search, filters, the selection and the two ways to add. Only the query text leaves the PC, from main. */
export function useOnline(initialQuery?: string): OnlineState {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const [query, setQuery] = useState(initialQuery ?? '')
  const [kind, setKindState] = useState<OnlineKindFilter>('any')
  const [freeToUse, setFree] = useState(true)
  const [status, setStatus] = useState<OnlineState['status']>('idle')
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState('')
  const [results, setResults] = useState<OnlineResult[]>([])
  const [found, setFound] = useState<OnlineSearchResult | null>(null)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [names, setNames] = useState<Record<string, string>>({})
  // Two sources, kept apart so neither can wipe the other: the live check of the name she typed, and main's refusal
  // when she pressed Add. A refusal belongs to the name it was about; a check that comes back later must not erase it.
  const [checkError, setNameError] = useState<string | undefined>()
  const [refusal, setRefusal] = useState<{ name: string; message: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const ticket = useRef(0)

  const run = useCallback(
    async (text: string, filters: { kind: OnlineKindFilter; freeToUse: boolean }) => {
      const mine = ++ticket.current
      setStatus('busy')
      setError(null)
      const result = await client['online:search']({ query: text, ...filters, page: 1 }).catch(
        () => null
      )
      if (mine !== ticket.current) return
      if (!result?.ok) {
        setStatus('error')
        setError(result ? result.message : 'The image libraries are busy. Try again in a minute.')
        return
      }
      setSearched(text)
      setResults(result.results)
      setFound(result)
      setPage(1)
      setSelectedId(result.results[0]?.id ?? null)
      setChecked(new Set())
      setNames({})
      setNameError(undefined)
      setRefusal(null)
      setStatus('ready')
    },
    [client]
  )

  const search = useCallback(() => {
    if (query.trim()) void run(query.trim(), { kind, freeToUse })
  }, [run, query, kind, freeToUse])

  // Coming from the editor or from a link with a query: search it straight away.
  const first = useRef(initialQuery)
  useEffect(() => {
    if (first.current?.trim()) void run(first.current.trim(), { kind: 'any', freeToUse: true })
  }, [run])

  const setKind = useCallback(
    (next: OnlineKindFilter) => {
      setKindState(next)
      if (searched) void run(searched, { kind: next, freeToUse })
    },
    [run, searched, freeToUse]
  )
  const setFreeToUse = useCallback(
    (on: boolean) => {
      setFree(on)
      if (searched) void run(searched, { kind, freeToUse: on })
    },
    [run, searched, kind]
  )

  const more = useCallback(() => {
    if (!found?.hasMore || loadingMore || page >= MAX_ONLINE_PAGES) return
    const mine = ticket.current
    setLoadingMore(true)
    client['online:search']({ query: searched, kind, freeToUse, page: page + 1 })
      .then((result) => {
        if (mine !== ticket.current) return
        if (!result.ok) return void toast.show({ message: result.message, tone: 'error' })
        setResults((current) => {
          const have = new Set(current.map((r) => r.id))
          return [...current, ...result.results.filter((r) => !have.has(r.id))]
        })
        setFound(result)
        setPage(page + 1)
      })
      .catch(() => toast.show({ message: COULDNT_SAVE, tone: 'error' }))
      .finally(() => setLoadingMore(false))
  }, [client, found, loadingMore, page, searched, kind, freeToUse, toast])

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId]
  )
  const name = selected ? (names[selected.id] ?? selected.proposedName) : ''
  const edited = selected ? names[selected.id] : undefined
  const nameError = refusal && refusal.name === name ? refusal.message : checkError

  const setName = useCallback(
    (next: string) => {
      if (!selected) return
      setNames((current) => ({ ...current, [selected.id]: next }))
      // The old message is about the old name; the live check answers for this one in a moment.
      setNameError(undefined)
    },
    [selected]
  )

  // Only a name she typed is checked: the proposed one is already valid and free.
  const settled = useDebounced(edited, 150)
  useEffect(() => {
    if (settled === undefined) return setNameError(undefined)
    let alive = true
    client
      .checkName({ name: settled })
      .then((check) => alive && setNameError(check.ok ? undefined : check.message))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client, settled])

  const addSelected = useCallback(async () => {
    if (!selected || nameError || adding) return
    setAdding(true)
    try {
      const result = await client['online:add']({
        items: [{ id: selected.id, name: edited }],
        mode: 'direct'
      })
      if (!result.ok) {
        if (result.code === 'invalid-input') setRefusal({ name, message: result.message })
        else toast.show({ message: result.message, tone: 'error' })
        return
      }
      const added = 'added' in result ? result.added[0] : undefined
      if (!added) return
      toast.show({
        message: `${added.name} added to Your assets`,
        action: {
          label: 'Undo',
          onAction: () => void client.remove({ assetId: added.id }).catch(() => undefined)
        }
      })
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
    } finally {
      setAdding(false)
    }
  }, [selected, nameError, adding, client, edited, name, toast])

  const addChecked = useCallback(async (): Promise<string | null> => {
    if (checked.size === 0 || adding) return null
    setAdding(true)
    try {
      const result = await client['online:add']({
        items: [...checked].map((id) => ({ id })),
        mode: 'review'
      })
      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return null
      }
      return 'batchId' in result ? result.batchId : null
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
      return null
    } finally {
      setAdding(false)
    }
  }, [checked, adding, client, toast])

  const down = found?.providers.filter((p) => !p.ok) ?? []
  const providerNote =
    down.length > 0
      ? `${down.map((p) => PROVIDER_LABELS[p.provider] ?? p.provider).join(' and ')} didn’t answer. Showing the others.`
      : null

  return {
    query,
    setQuery,
    kind,
    setKind,
    freeToUse,
    setFreeToUse,
    status,
    error,
    searched,
    results,
    total: found?.total ?? null,
    hasMore: Boolean(found?.hasMore) && page < MAX_ONLINE_PAGES,
    loadingMore,
    providerNote,
    selected,
    select: setSelectedId,
    checked,
    toggle: (id, on) =>
      setChecked((current) => {
        const next = new Set(current)
        if (on) next.add(id)
        else next.delete(id)
        return next
      }),
    clearChecked: () => setChecked(new Set()),
    name,
    setName,
    nameError,
    adding,
    search,
    more,
    addSelected,
    addChecked
  }
}
