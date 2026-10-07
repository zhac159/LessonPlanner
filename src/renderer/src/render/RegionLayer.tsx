import type { RenderJob } from '@shared/annotate/renderJob'
import { jobPixelSize } from '@shared/annotate/renderJob'
import { labelPosition, pathData } from './regionLayout'

/**
 * The circled regions drawn over the slide image: each loop in the region colour (orange, 5px) with its
 * number in a label pinned above its top-left corner. Pixel space, so strokes never scale with the slide.
 */
export function RegionLayer({
  job
}: {
  job: Pick<RenderJob, 'regions' | 'strokes' | 'viewport' | 'scale'>
}) {
  const image = jobPixelSize(job)
  if (job.regions.length === 0 && job.strokes.length === 0) return null
  return (
    <div className="render-regions" aria-hidden="true" data-testid="render-regions">
      <svg width={image.width} height={image.height} viewBox={`0 0 ${image.width} ${image.height}`}>
        {job.regions.map((region) => (
          <path
            key={region.n}
            className="render-regions__loop"
            data-region={region.n}
            d={pathData(region.path, job, true)}
          />
        ))}
        {job.strokes.map((stroke, index) => (
          <path
            key={index}
            className="render-regions__loop"
            data-stroke={index}
            d={pathData(stroke, job, false)}
          />
        ))}
      </svg>
      {job.regions.map((region) => (
        <div
          key={region.n}
          className="render-label"
          data-region-label={region.n}
          style={labelPosition(region, job, image)}
        >
          <span className="render-label__n">{region.n}</span>
        </div>
      ))}
    </div>
  )
}
