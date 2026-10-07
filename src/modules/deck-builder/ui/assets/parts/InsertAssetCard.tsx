import { AssetPicker, AssetSheet } from '@ui/assets'
import type { AssetLibrary } from '../hooks/useAssetLibrary'
import './InsertAssetCard.css'

export interface InsertAssetCardProps {
  library: AssetLibrary
  /** `{{sch` typed in the box: the picker mirrors it and has no search field of its own. */
  typedQuery?: string
  onPick(assetId: string): void
  /** Esc, × or ‹: closes without changing the text. */
  onClose(): void
  onOpenLibrary(): void
  onFindOnline(): void
}

/** A4: the asset picker as a card over the chat, above the Composer. Picking inserts `{{name}}`; it never places anything. */
export function InsertAssetCard({
  library,
  typedQuery,
  onPick,
  onClose,
  onOpenLibrary,
  onFindOnline
}: InsertAssetCardProps) {
  return (
    <AssetSheet
      variant="card"
      className="insert-asset"
      title="Add an asset"
      onBack={onClose}
      onClose={onClose}
      onEscape={onClose}
    >
      <AssetPicker
        key={library.loaded ? 'loaded' : 'loading'}
        mode="insert"
        assets={library.assets}
        typedQuery={typedQuery}
        autoFocus={typedQuery === undefined}
        onPick={onPick}
        onEscape={onClose}
        onOpenLibrary={onOpenLibrary}
        onFindOnline={onFindOnline}
      />
    </AssetSheet>
  )
}
