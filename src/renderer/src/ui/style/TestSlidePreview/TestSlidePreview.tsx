import { useId } from 'react'
import type { Slide } from '@shared/deck/types'
import type { StyleProfile } from '@shared/style/types'
import { Card, cx } from '../../atoms'
import { SlideView } from '../../slide'
import './TestSlidePreview.css'

export interface TestSlidePreviewProps {
  /** The test slide, or null before the first file is learned. */
  slide: Slide | null
  /** The style the slide is drawn in. */
  style: StyleProfile | null
  /** A new test slide is being made: shows a pulsing skeleton instead of the slide. */
  loading?: boolean
  /** Changes whenever the profile changes, so the new slide crossfades in. */
  version?: number
  /** Fixed slide scale instead of fitting the container (tests). */
  scale?: number
  className?: string
}

/** "Test slide in this style": a 16:9 slide drawn by the real slide renderer, or its placeholder. */
export function TestSlidePreview({
  slide,
  style,
  loading = false,
  version,
  scale,
  className
}: TestSlidePreviewProps) {
  const headingId = useId()
  return (
    <Card
      as="section"
      variant="inner"
      tone="sunken"
      className={cx('test-slide', className)}
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
    >
      <h3 id={headingId} className="test-slide__title">
        Test slide in this style
      </h3>
      <div className="test-slide__frame">
        {loading ? (
          <div className="test-slide__skeleton" data-testid="test-slide-skeleton" />
        ) : slide ? (
          <div key={version ?? slide.id} className="test-slide__fade">
            <SlideView
              slide={slide}
              style={style}
              scale={scale}
              aria-label="Test slide in this style"
            />
          </div>
        ) : (
          <p className="test-slide__placeholder">Your test slide appears after the first file.</p>
        )}
      </div>
    </Card>
  )
}
