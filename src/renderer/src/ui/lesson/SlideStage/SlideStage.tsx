import type { ReactNode } from 'react'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { cx } from '../../atoms/cx'
import { SlideView, type SlideViewProps, type SpotMode } from '../../slide'
import { useContainerScale } from '../../slide/useContainerScale'
import './SlideStage.css'

/** The stage's current size, handed to an overlay render function. */
export interface StageBox {
  /** Pixels per slide unit (stage width / 1920). */
  scale: number
  /** Stage size in pixels. */
  width: number
  height: number
}

export interface SlideStageProps {
  /** The slide on the stage. `null` shows the empty state. */
  slide: Slide | null
  /** The deck's StyleProfile (`null` = plain default style). */
  styleProfile: StyleProfile | null
  /** Accessible name of the slide, e.g. "Slide 3: What do plants need?". */
  label?: string
  /** Editor only: orange "doesn't fit" badge on text that overflows at its smallest size. */
  showFitBadges?: boolean
  onOverflowChange?: SlideViewProps['onOverflowChange']
  resolveAsset?: SlideViewProps['resolveAsset']
  /** Picture spots: `editor` draws the dashed "Picture spot" box (default hidden). */
  spots?: SpotMode
  /** Makes each spot a button; called with its element id (agents/ASSETS.md §3.12). */
  onFillSpot?: SlideViewProps['onFillSpot']
  /** Replaces the layout measurement used by shrink-to-fit (tests). */
  measurer?: SlideViewProps['measurer']
  /** Slides are still being generated: ground skeleton with a pulse instead of the slide. */
  loading?: boolean
  /** Screen-reader wording for `loading`. */
  loadingLabel?: string
  /** Drawn in place of the stage when there is no slide (and not loading), e.g. an EmptyState. */
  empty?: ReactNode
  /** Cursor for the active canvas tool: crosshair for circle and draw, text for text. */
  cursor?: 'default' | 'crosshair' | 'text'
  /**
   * Annotation layer above the slide (RegionOverlay, labels, sticky notes). It fills the stage, so an
   * SVG with `viewBox="0 0 1920 1080"` is in slide units; use `clientToSlide` to convert pointer
   * positions. Pass a function to get the stage size for pixel-sized parts such as labels.
   */
  children?: ReactNode | ((box: StageBox) => ReactNode)
  className?: string
}

/**
 * The big 16:9 slide in the editor: the slide renderer scaled to the width it is given (the screen sets
 * the width, up to 900px) with an annotation layer on top. The stage itself is not focusable.
 */
export function SlideStage({
  slide,
  styleProfile,
  label,
  showFitBadges = false,
  onOverflowChange,
  resolveAsset,
  spots,
  onFillSpot,
  measurer,
  loading = false,
  loadingLabel = 'Building your slides',
  empty,
  cursor = 'default',
  children,
  className
}: SlideStageProps) {
  const [stageRef, scale] = useContainerScale()

  const state = loading ? 'loading' : slide ? 'ready' : 'empty'
  const box: StageBox = { scale, width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }

  return (
    <div
      ref={stageRef}
      className={cx('slide-stage', className)}
      data-state={state}
      data-cursor={cursor}
      data-bare={(state === 'empty' && empty !== undefined) || undefined}
    >
      {state === 'empty' && empty}
      {state === 'ready' && slide && (
        <SlideView
          slide={slide}
          style={styleProfile}
          aria-label={label}
          showFitBadges={showFitBadges}
          onOverflowChange={onOverflowChange}
          resolveAsset={resolveAsset}
          spots={spots}
          onFillSpot={onFillSpot}
          measurer={measurer}
        />
      )}
      {state === 'loading' && (
        <div className="slide-stage__skeleton" role="status" aria-label={loadingLabel} />
      )}
      {state === 'ready' && children && (
        <div className="slide-stage__overlay">
          {typeof children === 'function' ? children(box) : children}
        </div>
      )}
    </div>
  )
}
