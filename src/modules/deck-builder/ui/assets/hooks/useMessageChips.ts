import { useEffect, useMemo, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import { assetTokenNames } from '@shared/assets/tokens'
import { ASSETS, type AssetChip, type AssetsApi, type AssetsEvents } from '@shared/contracts/assets'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'

/** Chips for the `{{names}}` in messages, by the name the message used (lower case). */
export type MessageChips = ReadonlyMap<string, AssetChip>

/**
 * Looks up every asset the transcript mentions: by id when the message stored a ref (so a rename shows the CURRENT name
 * and a deleted asset a greyed "removed" chip), by name for tokens without one (Claude's own text).
 */
export function useMessageChips(items: readonly ChatItem[]): MessageChips {
  const client = useClient<AssetsApi>(ASSETS)
  const [tick, setTick] = useState(0)
  useEvent<AssetsEvents>(ASSETS, 'changed', () => setTick((n) => n + 1))

  const wanted = useMemo(() => {
    const refs = new Map<string, { assetId: string; name: string }>()
    const names = new Set<string>()
    for (const item of items) {
      for (const ref of item.assets ?? []) refs.set(ref.name.toLowerCase(), ref)
      for (const name of assetTokenNames(item.text)) names.add(name)
    }
    const loose = [...names].filter((name) => !refs.has(name))
    return { refs: [...refs.values()], loose }
  }, [items])
  const key = JSON.stringify([wanted.refs.map((r) => `${r.assetId}:${r.name}`), wanted.loose])

  const [chips, setChips] = useState<MessageChips>(new Map())
  useEffect(() => {
    if (wanted.refs.length === 0 && wanted.loose.length === 0) return setChips(new Map())
    let current = true
    const ask = async (): Promise<void> => {
      const map = new Map<string, AssetChip>()
      const byRef = wanted.refs.length ? await client.chips({ refs: wanted.refs }) : []
      wanted.refs.forEach((ref) => {
        const chip = byRef.find((c) => c.assetId === ref.assetId)
        if (chip) map.set(ref.name.toLowerCase(), chip)
      })
      const byName = wanted.loose.length ? await client.resolveNames({ names: wanted.loose }) : []
      for (const chip of byName) map.set(chip.name.toLowerCase(), chip)
      if (current) setChips(map)
    }
    ask().catch(() => current && setChips(new Map()))
    return () => {
      current = false
    }
  }, [client, key, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  return chips
}
