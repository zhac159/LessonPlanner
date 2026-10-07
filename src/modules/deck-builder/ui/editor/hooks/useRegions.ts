import { useCallback, useEffect, useRef, useState } from 'react'
import type { Slide } from '@shared/deck/types'
import { useToast } from '@ui/overlays'
import type { RegionDraft } from '../../seams'

export interface RegionsState {
  regions: RegionDraft[]
  setRegions(next: RegionDraft[]): void
  add(region: RegionDraft): void
  remove(id: string): void
  highlightedId: string | null
  setHighlightedId(id: string | null): void
}

/**
 * The circled regions waiting to be sent (06 §8.4). They live here, not in the chat, because the stage draws them
 * and the chat sends them. A region on a slide that no longer exists is dropped with a toast (§8.4.12).
 */
export function useRegions(slides: readonly Slide[]): RegionsState {
  const toast = useToast()
  const [regions, setRegions] = useState<RegionDraft[]>([])
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const told = useRef(new Set<string>())

  const slideKey = slides.map((slide) => slide.id).join('|')
  useEffect(() => {
    if (regions.length === 0 || slides.length === 0) return
    const alive = new Set(slides.map((slide) => slide.id))
    const gone = regions.filter((region) => !alive.has(region.slideId))
    if (gone.length === 0) return
    setRegions(regions.filter((region) => alive.has(region.slideId)))
    for (const region of gone) {
      if (told.current.has(region.id)) continue
      told.current.add(region.id)
      toast.show({ message: `Region ${region.n} was on a deleted slide.` })
    }
    // Only deck changes can orphan a region: the list itself is changed through `setRegions`.
  }, [slideKey])

  const add = useCallback((region: RegionDraft) => setRegions((all) => [...all, region]), [])
  const remove = useCallback(
    (id: string) => setRegions((all) => all.filter((region) => region.id !== id)),
    []
  )
  return { regions, setRegions, add, remove, highlightedId, setHighlightedId }
}
