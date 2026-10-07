import { AssetPicker } from '@ui/assets'
import type { AssetLibrary } from '../hooks/useAssetLibrary'
import type { AssetSummary } from '@shared/contracts/assets'

export interface SpotAssetsTabProps {
  library: AssetLibrary
  suggestions: readonly AssetSummary[]
  search: string
  onSearch(search: string): void
  selectedId: string | null
  onPick(assetId: string): void
  onFindOnline(): void
  onOpenLibrary(): void
}

/** "Your assets" tab of A13: the A11 picker with "SUGGESTED FOR THIS SPOT". */
export function SpotAssetsTab({
  library,
  suggestions,
  search,
  onSearch,
  selectedId,
  onPick,
  onFindOnline,
  onOpenLibrary
}: SpotAssetsTabProps) {
  return (
    <AssetPicker
      mode="spot"
      assets={library.assets}
      featured={suggestions}
      selectedIds={selectedId ? [selectedId] : []}
      onPick={onPick}
      query={search}
      onQueryChange={onSearch}
      searchPlaceholder="Search your assets…"
      onFindOnline={onFindOnline}
      onOpenLibrary={onOpenLibrary}
    />
  )
}
