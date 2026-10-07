import { useEffect, useMemo, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import { assetTokenNames } from '@shared/assets/tokens'
import type { AssetKind, ChatAssetRef } from '@shared/assets/types'
import { ASSETS, type AssetChip, type AssetsApi, type AssetsEvents } from '@shared/contracts/assets'

/** What the chips and the Send button need to know about a name typed in `{{ }}`. */
export interface AssetNames {
  /** Chips by the lower-case NAME as typed (known names only). */
  chips: ReadonlyMap<string, AssetChip>
  /** The same as refs, for `chat:send`. */
  refs: ReadonlyMap<string, ChatAssetRef>
  lookup(name: string): ChatAssetRef | undefined
  /** The names the answer is about: unknown ones are only "unknown" once main has answered. */
  settled: boolean
}

const NONE: ReadonlyMap<string, never> = new Map<string, never>()

/**
 * Resolves the `{{names}}` in a draft against the library (`assets:resolveNames`). A name becomes a chip as soon as
 * the closing braces are typed; a name that is not an asset stays unknown (the Composer blocks Send and says so).
 */
export function useAssetNames(text: string): AssetNames {
  const client = useClient<AssetsApi>(ASSETS)
  const names = useMemo(() => assetTokenNames(text), [text])
  const key = names.join('|')
  const [found, setFound] = useState<{ key: string; chips: AssetChip[] }>({ key: '', chips: [] })
  const [tick, setTick] = useState(0)
  useEvent<AssetsEvents>(ASSETS, 'changed', () => setTick((n) => n + 1))

  useEffect(() => {
    if (names.length === 0) return setFound({ key, chips: [] })
    let current = true
    client
      .resolveNames({ names })
      .then((chips) => current && setFound({ key, chips }))
      .catch(() => current && setFound({ key, chips: [] }))
    return () => {
      current = false
    }
  }, [client, key, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const live = found.key === key ? found.chips : []
    const chips = new Map<string, AssetChip>()
    const refs = new Map<string, ChatAssetRef>()
    // `resolveNames` answers by the current name, which is what was typed.
    for (const name of names) {
      const chip = live.find((c) => c.name.toLowerCase() === name && !c.removed)
      if (!chip) continue
      chips.set(name, chip)
      refs.set(name, { assetId: chip.assetId, name: chip.name })
    }
    return {
      chips: names.length === 0 ? NONE : chips,
      refs: names.length === 0 ? NONE : refs,
      lookup: (name: string) => refs.get(name.toLowerCase()),
      settled: names.length === 0 || found.key === key
    }
  }, [found, key, names])
}

export type { AssetKind }
