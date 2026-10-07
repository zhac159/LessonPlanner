import { useEffect, useState } from 'react'
import type { RenderBridge, RenderJob } from '@shared/annotate/renderJob'
import { RenderStage, type RenderStageProps } from './RenderStage'

/**
 * The render page: waits for jobs from main, draws the latest one and reports when it is settled. A new
 * job replaces the previous drawing completely (the stage is keyed by job id, so no state leaks across).
 */
export function RenderApp({
  bridge,
  settle
}: {
  bridge: RenderBridge
  /** Replaces the settle step (tests). */
  settle?: RenderStageProps['settle']
}) {
  const [job, setJob] = useState<RenderJob | null>(null)

  useEffect(() => {
    const unsubscribe = bridge.onJob(setJob)
    bridge.listening()
    return unsubscribe
  }, [bridge])

  return job ? (
    <RenderStage key={job.id} job={job} onReport={bridge.report} settle={settle} />
  ) : null
}
