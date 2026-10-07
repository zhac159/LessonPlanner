import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FitMode } from '@shared/assets/fit'
import { listPictureSpots, type SpotRef } from '@shared/assets/spots'
import type { Slide } from '@shared/deck/types'
import type { PickerTab } from '@ui/assets'
import { useToast } from '@ui/overlays'
import { previewBox, previewTag, type StagePreview } from '../logic/preview'
import { placeLabel, snapshotPosition, spotAfter } from '../logic/spotFlow'
import type { PlaceOutcome } from './usePlaceAsset'
import { composerBox, useReturnFocus } from './useReturnFocus'
import { useSpotSources } from './useSpotSources'
import type { PlaceAssetArgs } from '@shared/assets/place'

export const ALL_FILLED = 'All picture spots are filled.'

export interface SpotFlowArgs {
  lessonId: string
  slides: readonly Slide[]
  /** The deck as it is right now (after a placement was committed). */
  latestSlides(): readonly Slide[]
  place(args: Omit<PlaceAssetArgs, 'lessonId'>): Promise<PlaceOutcome>
  /** The slide of the spot being filled goes on the stage. */
  onShowSlide(slideId: string): void
  /** Placed: the new picture is picked. */
  onPlaced(elementId: string): void
}

/**
 * A12 and A13: the spots Claude left, the sheet that fills them one after another and the live preview in the spot.
 * The sheet works through a snapshot of the spots taken when it opened, so "1 of 3" stays "of 3" while the live count
 * drops; "next" always comes from the live list.
 */
export function useSpotFlow({
  lessonId,
  slides,
  latestSlides,
  place,
  onShowSlide,
  onPlaced
}: SpotFlowArgs) {
  const toast = useToast()
  const focus = useReturnFocus()
  const spots = useMemo(() => listPictureSpots(slides), [slides])
  const counts = useMemo(() => {
    const perSlide = new Map<string, number>()
    for (const spot of spots) perSlide.set(spot.slideId, (perSlide.get(spot.slideId) ?? 0) + 1)
    return perSlide
  }, [spots])

  const [opened, setOpened] = useState<{ snapshot: string[]; elementId: string } | null>(null)
  const [tab, setTab] = useState<PickerTab>('assets')
  const [fit, setFit] = useState<FitMode>('fill')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = opened ? (spots.find((s) => s.elementId === opened.elementId) ?? null) : null
  const lastSeen = useRef<SpotRef | null>(null)
  if (current) lastSeen.current = current
  const sources = useSpotSources(lessonId, current, tab)

  const show = useCallback(
    (spot: SpotRef): void => {
      setOpened((was) => ({
        snapshot: was?.snapshot ?? spots.map((s) => s.elementId),
        elementId: spot.elementId
      }))
      setError(null)
      onShowSlide(spot.slideId)
    },
    [spots, onShowSlide]
  )

  const open = useCallback(
    (spot: SpotRef | undefined): void => {
      if (!spot) return
      focus.remember()
      setTab('assets')
      setFit('fill')
      setOpened({ snapshot: spots.map((s) => s.elementId), elementId: spot.elementId })
      setError(null)
      onShowSlide(spot.slideId)
    },
    [spots, onShowSlide, focus]
  )
  const dismiss = useCallback((): void => setOpened(null), [])
  const close = useCallback((): void => {
    setOpened(null)
    focus.restore(composerBox)
  }, [focus])

  // The spot being filled vanished (deleted, filled by undo/redo elsewhere): carry on with the next, or close.
  useEffect(() => {
    if (!opened || current || !lastSeen.current) return
    const next = spotAfter(spots, lastSeen.current, 'filled')
    if (next) show(next)
    else setOpened(null)
  }, [opened, current, spots, show])

  const target = current ? ({ kind: 'spot', elementId: current.elementId } as const) : null
  const slide = slides.find((s) => s.id === current?.slideId) ?? null
  const picture = sources.pick?.tab === tab ? sources.picture : null
  const placed = slide && picture && target ? previewBox(slide, picture.size, target, fit) : null
  const preview: StagePreview | null =
    placed && picture && current
      ? {
          box: placed.box,
          src: picture.src,
          hideElementId: placed.replaceElementId,
          tag: previewTag(picture.name, fit, 'the spot')
        }
      : null

  const placeIt = useCallback(async (): Promise<void> => {
    const source = sources.source()
    if (!current || !target || !source || placing || sources.pick?.tab !== tab) return
    setPlacing(true)
    setError(null)
    const outcome = await place({ slideId: current.slideId, source, target, fit })
    setPlacing(false)
    if (!outcome.ok) return setError(outcome.message)
    onPlaced(outcome.result.elementId)
    const next = spotAfter(listPictureSpots(latestSlides()), current, 'filled')
    if (next) show(next)
    else {
      setOpened(null)
      toast.show({ message: ALL_FILLED })
      focus.restore(composerBox)
    }
  }, [
    sources,
    current,
    target,
    placing,
    tab,
    place,
    fit,
    onPlaced,
    latestSlides,
    show,
    toast,
    focus
  ])

  const skip = useCallback((): void => {
    if (!current) return
    const next = spotAfter(spots, current, 'skipped')
    if (next) show(next)
    else close()
  }, [current, spots, show, close])

  const view = opened && current ? snapshotPosition(opened.snapshot, current.elementId) : null
  return {
    spots,
    counts,
    open,
    close,
    dismiss,
    isOpen: opened !== null,
    model:
      current && view
        ? {
            spot: current,
            k: view.k,
            n: view.n,
            primaryLabel: placeLabel(spots.length),
            tab,
            setTab,
            fit,
            setFit,
            sources,
            lowResolution: placed?.box.lowResolution ?? false,
            canPlace: !!picture && !placing,
            placing,
            error,
            placeIt,
            skip,
            close
          }
        : null,
    preview
  }
}

export type SpotSheetModel = NonNullable<ReturnType<typeof useSpotFlow>['model']>
