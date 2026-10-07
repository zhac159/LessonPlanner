import { useCallback, useMemo, useRef, useState } from 'react'
import type { AssetSummary } from '@shared/contracts/assets'

/** How many pictures can show the look (agents/ASSETS.md §3.8): more would blur it. */
export const MAX_BASED_ON = 6
export const TOO_MANY = 'Pick up to 6 so the look stays clear.'

export interface Selection {
  /** The card whose details show: the first one until she picks another. */
  selectedId: string | null
  select(id: string): void
  /** Selection mode (A8): checkboxes on the cards. */
  selecting: boolean
  setSelecting(on: boolean): void
  /** Ticked assets in the order she ticked them (they stay while a filter hides their cards). */
  ticked: AssetSummary[]
  isTicked(id: string): boolean
  /** Returns false when the seventh was refused. */
  tick(asset: AssetSummary, on: boolean): boolean
  clear(): void
}

/** What is selected in the grid: one card for the pane, or several ticks in selection mode. */
export function useSelection(items: readonly AssetSummary[]): Selection {
  const [picked, setPicked] = useState<string | null>(null)
  const [selecting, setSelectingState] = useState(false)
  const [kept, setKept] = useState<AssetSummary[]>([])
  // Several ticks can land in one go (a make intent): each must see the one before it.
  const latest = useRef<AssetSummary[]>(kept)
  const write = useCallback((next: AssetSummary[]): void => {
    latest.current = next
    setKept(next)
  }, [])

  const selectedId = useMemo(
    () => (picked && items.some((a) => a.id === picked) ? picked : (items[0]?.id ?? null)),
    [picked, items]
  )
  // Fresh data when the card is in the list (a rename), the remembered one when a filter hides it.
  const ticked = useMemo(
    () => kept.map((old) => items.find((a) => a.id === old.id) ?? old),
    [kept, items]
  )

  const tick = useCallback(
    (asset: AssetSummary, on: boolean): boolean => {
      const current = latest.current
      if (!on) {
        write(current.filter((x) => x.id !== asset.id))
        return true
      }
      if (current.some((x) => x.id === asset.id)) return true
      if (current.length >= MAX_BASED_ON) return false
      write([...current, asset])
      return true
    },
    [write]
  )

  return {
    selectedId,
    select: setPicked,
    selecting,
    setSelecting: (on) => {
      setSelectingState(on)
      if (!on) write([])
    },
    ticked,
    isTicked: (id) => kept.some((x) => x.id === id),
    tick,
    clear: () => write([])
  }
}
