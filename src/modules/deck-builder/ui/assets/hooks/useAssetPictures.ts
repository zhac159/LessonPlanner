import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import { ASSETS, type AssetsApi, type AssetsEvents } from '@shared/contracts/assets'
import type { Deck } from '@shared/deck/types'

/**
 * Pictures for the slides: the renderer is offline and has no file access, so the library's own copies stand in.
 * Lesson files keep the library asset's id (copy-on-use, §2.4), so `assetId` finds them. Every picture in the deck gets
 * its 256 px thumbnail; those on the slide on the stage get the 768 px preview too, which is what the stage draws.
 * A picture whose library asset is gone has no source and shows its caption box (main's `resolve` would be needed).
 */
export function useAssetPictures(deck: Pick<Deck, 'slides'>, currentSlideId: string | null) {
  const client = useClient<AssetsApi>(ASSETS)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [tick, setTick] = useState(0)
  useEvent<AssetsEvents>(ASSETS, 'changed', () => setTick((n) => n + 1))

  const ids = useMemo(() => {
    const all = new Map<string, string>()
    const onStage = new Set<string>()
    for (const slide of deck.slides) {
      for (const element of slide.elements) {
        if (element.type !== 'image' || !element.assetId) continue
        all.set(element.assetId, element.name ?? '')
        if (slide.id === currentSlideId) onStage.add(element.assetId)
      }
    }
    return { all, onStage }
  }, [deck.slides, currentSlideId])
  const allKey = [...ids.all.keys()].sort().join('|')
  const stageKey = [...ids.onStage].sort().join('|')

  useEffect(() => {
    if (ids.all.size === 0) return
    let current = true
    const refs = [...ids.all].map(([assetId, name]) => ({ assetId, name }))
    Promise.resolve(client.chips({ refs }))
      .then((chips) => {
        if (!current) return
        const next: Record<string, string> = {}
        for (const chip of chips) if (chip.thumbDataUrl) next[chip.assetId] = chip.thumbDataUrl
        setThumbs(next)
      })
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [client, allKey, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let current = true
    for (const assetId of ids.onStage) {
      Promise.resolve(client.get({ assetId }))
        .then((result) => {
          const url = result.ok ? result.asset.previewDataUrl : null
          if (current && url) setPreviews((was) => ({ ...was, [assetId]: url }))
        })
        .catch(() => undefined)
    }
    return () => {
      current = false
    }
  }, [client, stageKey, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback(
    (assetId: string): string | undefined => previews[assetId] ?? thumbs[assetId],
    [previews, thumbs]
  )
}
