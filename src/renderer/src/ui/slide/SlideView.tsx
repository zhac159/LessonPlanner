import { memo, useEffect, useId, useMemo } from 'react'
import { resolveFill } from '@shared/deck/tokens'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { cx } from '../atoms/cx'
import { isPictureSpot } from '@shared/assets/spots'
import { SlideContext, type SlideRenderContext, type SpotMode } from './context'
import { ElementView } from './elements/ElementView'
import { domFitMeasurer, type FitMeasurer } from './fit'
import { slideFonts } from './bundledFonts'
import { useContainerScale } from './useContainerScale'
import './slide.css'

export interface SlideViewProps {
  slide: Slide
  /** The deck's StyleProfile (`null` = plain default style). Slides never use app colours or fonts. */
  style: StyleProfile | null
  /** Maps a lesson asset id to a displayable URL. */
  resolveAsset?: SlideRenderContext['resolveAsset']
  /** Editor only: show the orange "doesn't fit" badge on text that overflows at its smallest size. */
  showFitBadges?: boolean
  /** Reports elements that start/stop overflowing (feeds the "doesn't fit" flag sent to Claude). */
  onOverflowChange?: SlideRenderContext['onOverflowChange']
  /**
   * Picture spots (empty image placeholders): `editor` draws the dashed "Picture spot" box (stage), `thumbnail`
   * a faint dashed box without text (filmstrip, lesson cards), `hidden` nothing. Default `hidden`, so present
   * mode, exports and the offscreen renderer never show spot chrome.
   */
  spots?: SpotMode
  /** Editor only: makes the spot a button; called with the spot's element id. */
  onFillSpot?: SlideRenderContext['onFillSpot']
  className?: string
  /** Fixed scale instead of fitting the container (tests, fixed-size exports). */
  scale?: number
  /** Replace the layout measurement used by shrink-to-fit (tests). */
  measurer?: FitMeasurer
  'aria-label'?: string
}

/**
 * THE slide renderer (design/deck-model.md §4): absolutely positioned HTML at 1920x1080 scaled to its
 * container with a CSS transform. The same component draws the stage, filmstrip thumbnails, Home cards
 * and present mode. Fill the parent's width: the height follows from the 16:9 aspect ratio.
 */
export const SlideView = memo(function SlideView({
  slide,
  style,
  resolveAsset,
  showFitBadges = false,
  onOverflowChange,
  spots = 'hidden',
  onFillSpot,
  className,
  scale,
  measurer = domFitMeasurer,
  'aria-label': ariaLabel
}: SlideViewProps) {
  const [hostRef, appliedScale] = useContainerScale(scale)
  const instanceId = useId().replace(/[^\w-]/g, '')

  useEffect(() => {
    void slideFonts.load(style)
  }, [style])

  const context = useMemo<SlideRenderContext>(
    () => ({
      style,
      resolveAsset,
      showFitBadges,
      measurer,
      onOverflowChange,
      spots,
      onFillSpot,
      instanceId
    }),
    [style, resolveAsset, showFitBadges, measurer, onOverflowChange, spots, onFillSpot, instanceId]
  )
  const background = resolveFill(slide.background ?? { color: 'token:background' }, style)

  return (
    <div
      ref={hostRef}
      className={cx('slide-view', className)}
      role="group"
      aria-label={ariaLabel}
      data-slide-id={slide.id}
    >
      <div
        className="slide-canvas"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          background,
          transform: `scale(${appliedScale})`
        }}
      >
        <SlideContext.Provider value={context}>
          {slide.elements.map((element) =>
            spots === 'hidden' && isPictureSpot(element) ? null : (
              <ElementView key={element.id} element={element} />
            )
          )}
        </SlideContext.Provider>
      </div>
    </div>
  )
})
