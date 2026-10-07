import { createContext, useContext } from 'react'
import type { StyleProfile } from '@shared/style/types'
import type { FitMeasurer } from './fit'

/** `editor` draws the full spot, `thumbnail` a faint dashed box, `hidden` nothing. */
export type SpotMode = 'editor' | 'thumbnail' | 'hidden'

/** Everything element views need from the enclosing SlideView. */
export interface SlideRenderContext {
  style: StyleProfile | null
  /** Maps a lesson asset id to a displayable URL (`null`/`undefined` = not available yet). */
  resolveAsset?: (assetId: string) => string | null | undefined
  /** Editor only: show the orange "doesn't fit" badge. Never in thumbnails, present mode or exports. */
  showFitBadges: boolean
  measurer: FitMeasurer
  /** Called when an element starts/stops overflowing at its smallest size. */
  onOverflowChange?: (elementId: string, overflow: boolean) => void
  /** How picture spots are drawn: editor chrome, a faint dashed thumbnail box, or not at all (present, export). */
  spots: SpotMode
  /** Editor only: called when a picture spot is clicked ("Fill this spot"). */
  onFillSpot?: (elementId: string) => void
  /** Unique per SlideView; used to scope SVG ids so diagrams on one page never clash. */
  instanceId: string
}

export const SlideContext = createContext<SlideRenderContext | null>(null)

/** Context of the enclosing SlideView. Throws when used outside one (a programming error). */
export function useSlideContext(): SlideRenderContext {
  const ctx = useContext(SlideContext)
  if (!ctx) throw new Error('Slide element views must be rendered inside <SlideView>')
  return ctx
}
