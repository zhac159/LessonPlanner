import { useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { ASSETS, type AssetsApi, type AssetSummary } from '@shared/contracts/assets'

/** "Suggested for this slide / spot": assets ranked locally in main (no Claude call). */
export function useSuggestions(
  args: { lessonId: string; slideId: string | null; words?: string },
  enabled = true
): AssetSummary[] {
  const client = useClient<AssetsApi>(ASSETS)
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const { lessonId, slideId, words } = args

  useEffect(() => {
    if (!enabled || !slideId) return setAssets([])
    let current = true
    Promise.resolve(client.suggest({ lessonId, slideId, words, limit: 3 }))
      .then((result) => current && setAssets(result.ok ? result.assets : []))
      .catch(() => current && setAssets([]))
    return () => {
      current = false
    }
  }, [client, enabled, lessonId, slideId, words])

  return assets
}
