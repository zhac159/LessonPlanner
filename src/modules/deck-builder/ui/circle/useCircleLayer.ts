import { useCallback, useEffect, useMemo, useState } from 'react'
import { isTextEntry, type OverlayRegion } from '@ui/editor'
import { useToast } from '@ui/overlays'
import type { StrokePath } from '@shared/contracts/deck-builder-chat'
import type { CircleLayerProps } from '../seams'
import { barPosition } from './barPosition'
import { MAX_REGIONS, buildRegion, closeLoop, newRegionId, regionAt } from './regions'
import { useSentHighlight } from './sentHighlight'

/** Optional extras the editor can wire on top of the agreed seam. */
export interface CircleLayerExtras {
  /** Remove a draft region (its label's ×, or Delete / Backspace on the selected one). */
  onRemoveRegion?(id: string): void
  /** The stage's size: with the two callbacks below it turns on the "Add asset here" bar (A10). */
  box?: { scale: number; width: number; height: number }
  /** "Add asset here": opens the A11 sheet for this region. */
  onAddAsset?(regionId: string): void
  /** "Ask Claude": focuses the Composer (today's flow). */
  onAskClaude?(): void
}

export const TOO_MANY_REGIONS = 'Up to 9 circles per message.'

/**
 * The circle tool's behaviour (06 §8.4): finished loops become numbered regions, clicks select a loop,
 * Delete removes the selected one, Esc deselects and then leaves the tool. Returns what RegionOverlay draws.
 */
export function useCircleLayer(props: CircleLayerProps & CircleLayerExtras) {
  const { slide, regions, highlightedRegionId, active, onAddRegion, onExit, onRemoveRegion } = props
  const { box, onAddAsset, onAskClaude } = props
  const toast = useToast()
  const sent = useSentHighlight()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The bar belongs to the most recently drawn loop (or the one she clicked); × hides only the bar.
  const [bar, setBar] = useState<{ id: string; hidden: boolean } | null>(null)
  const onSlide = useMemo(() => regions.filter((r) => r.slideId === slide.id), [regions, slide.id])

  const select = useCallback(
    (point: [number, number]) => {
      const hit = regionAt(point, onSlide)
      setSelectedId(hit?.id ?? null)
      if (hit) setBar({ id: hit.id, hidden: false })
    },
    [onSlide]
  )

  const complete = useCallback(
    (points: StrokePath) => {
      const path = closeLoop(points)
      if (!path) return select(points[0])
      if (regions.length >= MAX_REGIONS) return toast.show({ message: TOO_MANY_REGIONS })
      const region = buildRegion({ slide, path, existing: regions, id: newRegionId() })
      setSelectedId(null)
      setBar({ id: region.id, hidden: false })
      onAddRegion(region)
    },
    [regions, select, slide, toast, onAddRegion]
  )

  const barRegion = bar ? (onSlide.find((r) => r.id === bar.id) ?? null) : null
  const barShown = !!(active && box && onAddAsset && onAskClaude && barRegion && bar && !bar.hidden)

  // Delete removes the selected loop; Esc hides the bar, then deselects, then leaves the tool.
  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isTextEntry(event.target)) return
      if (event.key === 'Escape') {
        if (barShown && bar) setBar({ ...bar, hidden: true })
        else if (selectedId) setSelectedId(null)
        else onExit()
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault()
        onRemoveRegion?.(selectedId)
        setSelectedId(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, selectedId, bar, barShown, onExit, onRemoveRegion])

  const overlayRegions = useMemo<OverlayRegion[]>(() => {
    const drafts = onSlide.map((region) => ({
      id: region.id,
      n: region.n,
      path: region.path,
      linked: region.id === highlightedRegionId || region.id === selectedId
    }))
    if (!sent || sent.slideId !== slide.id) return drafts
    return [
      ...drafts,
      { id: sent.id, n: sent.n, path: sent.path, caption: sent.caption, linked: true }
    ]
  }, [onSlide, highlightedRegionId, selectedId, sent, slide.id])

  const activeRegionId =
    sent && sent.slideId === slide.id
      ? sent.id
      : onSlide.some((r) => r.id === highlightedRegionId)
        ? highlightedRegionId
        : null

  const actionBar =
    active && box && onAddAsset && onAskClaude && barRegion && bar && !bar.hidden
      ? {
          regionNumber: barRegion.n,
          style: barPosition(barRegion.bbox, box.scale, box),
          onAddAsset: () => onAddAsset(barRegion.id),
          onAskClaude,
          onDismiss: () => setBar({ id: barRegion.id, hidden: true })
        }
      : null

  return { overlayRegions, activeRegionId, complete, select, onRemoveRegion, actionBar }
}
