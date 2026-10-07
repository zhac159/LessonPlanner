import { AssetPicker, AssetSheet, FitControl, replaceLabel } from '@ui/assets'
import { Button, Callout } from '@ui/atoms'
import type { RegionSheetModel } from '../hooks/useRegionPlacement'
import './sheets.css'

export interface RegionAssetSheetProps {
  model: RegionSheetModel
  onFindOnline(): void
}

/**
 * A11: "Add to region 1". Pick an asset, see it scaled to the circle on the stage, choose fit or fill and whether it
 * replaces the picture underneath, then "Place it". Presentational: the model comes from `useRegionPlacement`.
 */
export function RegionAssetSheet({ model, onFindOnline }: RegionAssetSheetProps) {
  const n = model.region.n
  const title = `Add to region ${n}`
  return (
    <AssetSheet
      title={title}
      subtitle="Pick an asset. I’ll scale it to fit your circle."
      badge={n}
      onBack={model.close}
      onEscape={model.close}
      onSubmitShortcut={() => void model.placeIt()}
      footer={
        <>
          <Button variant="secondary" onClick={model.close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={model.placing}
            loadingLabel="Placing…"
            disabled={model.pickedId === null}
            onClick={() => void model.placeIt()}
          >
            Place it
          </Button>
        </>
      }
    >
      <>
        <AssetPicker
          key={model.library.loaded ? 'loaded' : 'loading'}
          mode="place"
          assets={model.library.assets}
          featured={model.suggestions}
          selectedIds={model.pickedId ? [model.pickedId] : []}
          onPick={model.pick}
          query={model.search}
          onQueryChange={model.setSearch}
          searchPlaceholder="Search your assets…"
          autoFocus
          onFindOnline={onFindOnline}
        />
        {model.library.libraryCount > 0 && (
          <FitControl
            target="circle"
            value={model.fit}
            onChange={model.setFit}
            lowResolution={model.lowResolution}
            replace={
              model.underneath
                ? {
                    label: replaceLabel(model.underneath),
                    checked: model.replace,
                    onChange: model.setReplace
                  }
                : undefined
            }
          />
        )}
        {model.error && <Callout variant="error">{model.error}</Callout>}
      </>
    </AssetSheet>
  )
}
