import { useCallback, type ReactNode } from 'react'
import { useShell } from '@renderer/sdk'
import type { Slide } from '@shared/deck/types'
import type { RegionsState } from '../../editor/hooks/useRegions'
import type { UseLesson } from '../../editor/hooks/useLesson'
import type { StagePreview } from '../logic/preview'
import { RegionAssetSheet } from '../parts/RegionAssetSheet'
import { SpotSheet } from '../parts/SpotSheet'
import { usePlaceAsset } from './usePlaceAsset'
import { useRegionPlacement } from './useRegionPlacement'
import { useSpotFlow } from './useSpotFlow'

export interface AssetEditorArgs {
  lessonId: string
  lesson: UseLesson
  /** The deck's slides (not the live generation view): spots and placements are about saved slides. */
  slides: readonly Slide[]
  regions: RegionsState
  /** Another slide goes on the stage (the one whose spot is being filled). */
  onShowSlide(slideId: string): void
  /** The new picture is picked on the stage. */
  onSelectElement(elementId: string): void
}

export interface AssetEditor {
  /** Replaces the chat panel while open (A11 or A13). */
  sheet: ReactNode
  /** Drawn on the stage while a picture is being chosen. */
  preview: StagePreview | null
  /** Empty spots per slide id, for the filmstrip badges. */
  spotCounts: ReadonlyMap<string, number>
  /** The live count of empty spots, for the card in the chat. */
  spots: { count: number; onFillFirst(): void }
  openRegion(regionId: string): void
  fillSpot(elementId: string): void
  fillFirstOnSlide(slideId: string): void
  fillFirst(): void
}

/**
 * Everything "Your assets" adds to the editor's screen state: the A11 sheet for a circled region, the A13 sheet and the
 * live preview for picture spots, and the numbers the filmstrip and chat show. One sheet is open at a time.
 */
export function useAssetEditor(args: AssetEditorArgs): AssetEditor {
  const { lessonId, lesson, slides, regions, onShowSlide, onSelectElement } = args
  const { navigate } = useShell()
  const place = usePlaceAsset(lessonId, lesson)
  const latestSlides = useCallback(
    () => lesson.latest.current?.deck.slides ?? slides,
    [lesson, slides]
  )

  const region = useRegionPlacement({
    lessonId,
    slides,
    regions: regions.regions,
    place,
    onPlaced: (regionId, elementId) => {
      regions.remove(regionId)
      onSelectElement(elementId)
    }
  })
  const spot = useSpotFlow({
    lessonId,
    slides,
    latestSlides,
    place,
    onShowSlide,
    onPlaced: onSelectElement
  })

  const openRegion = useCallback(
    (regionId: string): void => {
      spot.dismiss()
      region.open(regionId)
    },
    [spot, region]
  )
  const fillSpot = useCallback(
    (elementId: string): void => {
      region.dismiss()
      spot.open(spot.spots.find((s) => s.elementId === elementId))
    },
    [spot, region]
  )
  const fillFirstOnSlide = useCallback(
    (slideId: string): void => {
      region.dismiss()
      spot.open(spot.spots.find((s) => s.slideId === slideId))
    },
    [spot, region]
  )
  const fillFirst = useCallback((): void => {
    region.dismiss()
    spot.open(spot.spots[0])
  }, [spot, region])

  const goToAssets = useCallback(
    (intent: { kind: 'library' } | { kind: 'online' }) => navigate('assets', intent),
    [navigate]
  )
  const sheet: ReactNode = region.model ? (
    <RegionAssetSheet model={region.model} onFindOnline={() => goToAssets({ kind: 'online' })} />
  ) : spot.model ? (
    <SpotSheet
      model={spot.model}
      onOpenLibrary={() => goToAssets({ kind: 'library' })}
      onAddPictureMaker={() => navigate('settings', { kind: 'ai' })}
    />
  ) : null

  return {
    sheet,
    preview: region.preview ?? spot.preview,
    spotCounts: spot.counts,
    spots: { count: spot.spots.length, onFillFirst: fillFirst },
    openRegion,
    fillSpot,
    fillFirstOnSlide,
    fillFirst
  }
}
