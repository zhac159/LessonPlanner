import { useCallback, useEffect, useRef } from 'react'
import { jobPixelSize, type RenderJob, type RenderReport } from '@shared/annotate/renderJob'
import { SLIDE_WIDTH } from '@shared/deck/types'
import { SlideView, slideFonts } from '@ui/slide'
import { RegionLayer } from './RegionLayer'
import { waitUntilSettled } from './settle'
import './render.css'

export interface RenderStageProps {
  job: RenderJob
  /** Called once when the picture is final (or when settling failed). */
  onReport: (report: RenderReport) => void
  /** Replaces the settle step (tests). */
  settle?: typeof waitUntilSettled
}

/**
 * One render job on screen: the viewport of the slide at the job's scale, exactly `size` pixels, with the
 * region loops on top. Tells the caller when fonts, pictures and text fitting have settled.
 */
export function RenderStage({ job, onReport, settle = waitUntilSettled }: RenderStageProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { width, height } = jobPixelSize(job)
  const resolveAsset = useCallback((id: string) => job.assets[id], [job.assets])
  const reported = useRef(onReport)
  reported.current = onReport

  useEffect(() => {
    let cancelled = false
    const root = rootRef.current
    if (!root) return
    settle(root, { loadFonts: () => slideFonts.load(job.style) }).then(
      () => !cancelled && reported.current({ id: job.id, ok: true }),
      (error: unknown) =>
        !cancelled &&
        reported.current({
          id: job.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
    )
    return () => {
      cancelled = true
    }
  }, [job.id, job.style, settle])

  return (
    <div ref={rootRef} className="render-stage" data-job-id={job.id} style={{ width, height }}>
      <div
        className="render-stage__slide"
        style={{
          width: SLIDE_WIDTH * job.scale,
          transform: `translate(${-job.viewport.x * job.scale}px, ${-job.viewport.y * job.scale}px)`
        }}
      >
        <SlideView
          slide={job.slide}
          style={job.style}
          scale={job.scale}
          resolveAsset={resolveAsset}
        />
      </div>
      <RegionLayer job={job} />
    </div>
  )
}
