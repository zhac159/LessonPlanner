import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import {
  ASSETS,
  type AssetsApi,
  type AssetsEvents,
  type AssetSummary
} from '@shared/contracts/assets'

export interface AssetLibrary {
  assets: AssetSummary[]
  /** All assets whatever the search: "You don't have any assets yet." is `libraryCount === 0`. */
  libraryCount: number
  /** The first answer has arrived (or failed). */
  loaded: boolean
  /** Asking main failed: the pickers show an empty library rather than an error. */
  failed: boolean
}

const EMPTY: AssetLibrary = { assets: [], libraryCount: 0, loaded: false, failed: false }

/**
 * The library for the editor's pickers (A4, A11, A13): newest used first, optionally searched in main. Refreshes when
 * the library changes (an asset added, renamed or removed in another screen). Only reads while `enabled`.
 */
export function useAssetLibrary(search = '', enabled = true): AssetLibrary {
  const client = useClient<AssetsApi>(ASSETS)
  const [library, setLibrary] = useState<AssetLibrary>(EMPTY)
  const issued = useRef(0)

  const load = useCallback(async (): Promise<void> => {
    issued.current += 1
    const mine = issued.current
    try {
      const page = await client.list({
        search: search.trim() || undefined,
        sort: 'recent',
        limit: 60
      })
      if (mine === issued.current) {
        setLibrary({
          assets: page.items,
          libraryCount: page.libraryCount,
          loaded: true,
          failed: false
        })
      }
    } catch {
      if (mine === issued.current) setLibrary((was) => ({ ...was, loaded: true, failed: true }))
    }
  }, [client, search])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])
  useEvent<AssetsEvents>(ASSETS, 'changed', () => {
    if (enabled) void load()
  })
  return library
}
