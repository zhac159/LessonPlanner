import { useCallback, useEffect, useMemo, useState } from 'react'
import { underlyingPicture, type FitMode } from '@shared/assets/fit'
import type { AssetSummary } from '@shared/contracts/assets'
import type { Slide } from '@shared/deck/types'
import type { RegionDraft } from '../../seams'
import { previewBox, previewTag, regionTarget, type StagePreview } from '../logic/preview'
import { useAssetLibrary, type AssetLibrary } from './useAssetLibrary'
import type { PlaceOutcome } from './usePlaceAsset'
import { composerBox, useReturnFocus } from './useReturnFocus'
import { useSuggestions } from './useSuggestions'

export interface RegionPlacementArgs {
  lessonId: string
  slides: readonly Slide[]
  regions: readonly RegionDraft[]
  place(args: {
    slideId: string
    source: { kind: 'library'; assetId: string }
    target: ReturnType<typeof regionTarget>
    fit: FitMode
  }): Promise<PlaceOutcome>
  /** Placed: the region and its chip go (like a send) and the new element is picked. */
  onPlaced(regionId: string, elementId: string): void
}

/** Everything the A11 sheet shows and does for one circled region. */
export interface RegionSheetModel {
  region: RegionDraft
  library: AssetLibrary
  search: string
  setSearch(search: string): void
  suggestions: AssetSummary[]
  pickedId: string | null
  pick(assetId: string): void
  fit: FitMode
  setFit(fit: FitMode): void
  /** What is under the circle ("Photo: leaf in sunlight"), or null when there is no picture to swap. */
  underneath: string | null
  replace: boolean
  setReplace(replace: boolean): void
  lowResolution: boolean
  /** The live note: `leaf_cross_section fitted to region 1`. */
  announcement: string
  placing: boolean
  error: string | null
  placeIt(): Promise<void>
  close(): void
}

/**
 * A11: choose an asset for a circled area and see it fitted live before placing it. The hook owns the choices (asset,
 * fit, replace) and derives the stage preview from them with the same maths main uses for the ChangeSet.
 */
export function useRegionPlacement(args: RegionPlacementArgs) {
  const { lessonId, slides, regions, place, onPlaced } = args
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [fit, setFit] = useState<FitMode>('fit')
  const [replaceChoice, setReplace] = useState<boolean | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const focus = useReturnFocus()

  const region = regions.find((r) => r.id === openId) ?? null
  const slide = slides.find((s) => s.id === region?.slideId) ?? null
  const library = useAssetLibrary(search, region !== null)
  const suggestions = useSuggestions(
    { lessonId, slideId: region?.slideId ?? null },
    region !== null
  )

  const under = useMemo(
    () => (slide && region ? underlyingPicture(slide, { path: region.path }) : undefined),
    [slide, region]
  )
  const replace = under ? (replaceChoice ?? true) : false
  const asset = [...library.assets, ...suggestions].find((a) => a.id === pickedId) ?? null

  // The first suggestion is chosen when the sheet opens, so the stage shows something at once.
  useEffect(() => {
    if (region && !pickedId && suggestions[0]) setPickedId(suggestions[0].id)
  }, [region, pickedId, suggestions])
  // The region vanished (sent, removed, its slide deleted): the sheet goes with it.
  useEffect(() => {
    if (openId && !region) setOpenId(null)
  }, [openId, region])

  const target = region ? regionTarget(region, replace && under ? under.id : null) : null
  const placed =
    slide && asset && target
      ? previewBox(slide, { width: asset.width, height: asset.height }, target, fit)
      : null
  const preview: StagePreview | null =
    placed && asset && region
      ? {
          box: placed.box,
          src: asset.thumbDataUrl,
          hideElementId: placed.replaceElementId,
          tag: previewTag(asset.name, fit, `region ${region.n}`)
        }
      : null

  const open = useCallback(
    (regionId: string): void => {
      focus.remember()
      setSearch('')
      setPickedId(null)
      setFit('fit')
      setReplace(null)
      setError(null)
      setOpenId(regionId)
    },
    [focus]
  )
  const close = useCallback((): void => {
    setOpenId(null)
    focus.restore(composerBox)
  }, [focus])

  const placeIt = useCallback(async (): Promise<void> => {
    if (!region || !asset || !target || placing) return
    setPlacing(true)
    setError(null)
    const outcome = await place({
      slideId: region.slideId,
      source: { kind: 'library', assetId: asset.id },
      target,
      fit
    })
    setPlacing(false)
    if (!outcome.ok) return setError(outcome.message)
    setOpenId(null)
    onPlaced(region.id, outcome.result.elementId)
    focus.restore(composerBox)
  }, [region, asset, target, placing, place, fit, onPlaced, focus])

  const model: RegionSheetModel | null =
    region === null
      ? null
      : {
          region,
          library,
          search,
          setSearch,
          suggestions,
          pickedId,
          pick: setPickedId,
          fit,
          setFit,
          underneath: under ? under.placeholder?.description || under.alt || 'Picture' : null,
          replace,
          setReplace,
          lowResolution: placed?.box.lowResolution ?? false,
          announcement: preview ? preview.tag.replace(' · ', ' ') : '',
          placing,
          error,
          placeIt,
          close
        }
  /** Closes without moving focus (another sheet is taking over). */
  const dismiss = useCallback((): void => setOpenId(null), [])
  return { open, close, dismiss, model, preview }
}
