import { RegionActionBar } from '@ui/assets'
import { RegionOverlay } from '@ui/editor'
import type { CircleLayerProps } from '../seams'
import './CircleLayer.css'
import { useCircleLayer, type CircleLayerExtras } from './useCircleLayer'

/**
 * The circle tool's drawing layer, a child of SlideStage (06 §8.4): draws the regions of the current slide
 * with their numbers, lets the teacher draw a loop while the tool is active, and dims everything outside
 * a highlighted region. Finished loops reach `onAddRegion` already simplified, hit-tested and numbered.
 */
export function CircleLayer(props: CircleLayerProps & CircleLayerExtras) {
  const { active, onExit } = props
  const { overlayRegions, activeRegionId, complete, select, onRemoveRegion, actionBar } =
    useCircleLayer(props)
  return (
    <div
      className="circle-layer"
      onContextMenu={(event) => {
        if (!active) return
        event.preventDefault()
        onExit()
      }}
    >
      <RegionOverlay
        active={active}
        regions={overlayRegions}
        activeRegionId={activeRegionId}
        onComplete={complete}
        onPoint={select}
        onRemoveRegion={onRemoveRegion}
      />
      {actionBar && (
        <RegionActionBar
          className="circle-layer__bar"
          regionNumber={actionBar.regionNumber}
          style={{ left: actionBar.style.left, top: actionBar.style.top }}
          onAddAsset={actionBar.onAddAsset}
          onAskClaude={actionBar.onAskClaude}
          onDismiss={actionBar.onDismiss}
        />
      )}
    </div>
  )
}
