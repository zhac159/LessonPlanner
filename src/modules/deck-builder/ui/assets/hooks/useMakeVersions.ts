import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { MakeVersions } from '@shared/assets/pictureMaker'
import type { AssetKind } from '@shared/assets/types'
import {
  ASSETS,
  type AssetsApi,
  type AssetsEvents,
  type MakeMode,
  type MakeProgress
} from '@shared/contracts/assets'

export interface MakeStatus {
  mode: MakeMode
  modelLabel: string | null
  perPictureUsd: number | null
}

/** "Make one" for a picture spot: what can be made now, a job and its versions (A8's service, no Keep step). */
export function useMakeVersions(enabled: boolean) {
  const client = useClient<AssetsApi>(ASSETS)
  const [status, setStatus] = useState<MakeStatus | null>(null)
  const [progress, setProgress] = useState<MakeProgress | null>(null)
  const [starting, setStarting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const job = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || status) return
    let current = true
    Promise.resolve(client['make:mode']())
      .then((mode) => current && setStatus(mode))
      .catch(
        () => current && setStatus({ mode: 'unavailable', modelLabel: null, perPictureUsd: null })
      )
    return () => {
      current = false
    }
  }, [client, enabled, status])

  useEvent<AssetsEvents, 'make:progress'>(ASSETS, 'make:progress', (event) => {
    if (event.jobId === job.current) setProgress(event)
  })

  const start = useCallback(
    async (request: {
      prompt: string
      versions: MakeVersions
      basedOn: string[]
      kind?: AssetKind
    }) => {
      setStarting(true)
      setFailure(null)
      setProgress(null)
      try {
        const result = await client['make:start'](request)
        if (!result.ok) return setFailure(result.message)
        job.current = result.jobId
        setProgress({ jobId: result.jobId, stage: 'describing', versions: [] })
      } catch {
        setFailure('Couldn’t start that. Try again.')
      } finally {
        setStarting(false)
      }
    },
    [client]
  )

  /** Leaves the job (a different spot, or "Try again"); a running job is cancelled. */
  const reset = useCallback((): void => {
    const jobId = job.current
    job.current = null
    setProgress(null)
    setFailure(null)
    if (jobId) void Promise.resolve(client['make:cancel']({ jobId })).catch(() => undefined)
  }, [client])

  return {
    status,
    progress,
    starting,
    failure,
    jobId: progress?.jobId ?? null,
    start,
    reset
  }
}
