import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { MakeVersions } from '@shared/assets/pictureMaker'
import type { AssetSummary, AssetsEvents, MakeMode, MakeProgress } from '@shared/contracts/assets'
import { useToast } from '@ui/overlays'
import type { VersionView } from '@ui/assets'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_SAVE } from '../model/messages'
import { commonKind, suggestMakeName } from '../model/makeName'
import { useDebounced } from './useDebounced'

export interface MakeModeInfo {
  mode: MakeMode
  modelLabel: string | null
  perPictureUsd: number | null
}

export interface MakeNew {
  mode: MakeModeInfo | null
  prompt: string
  setPrompt(prompt: string): void
  versions: MakeVersions
  setVersions(versions: MakeVersions): void
  /** A job is running (describing or drawing). */
  busy: boolean
  /** Present once a job started: the 2 or 4 tiles, as they finish. */
  versionViews: VersionView[] | null
  stageLabel: string | undefined
  selected: number | null
  select(version: number): void
  name: string
  setName(name: string): void
  nameError: string | undefined
  keeping: boolean
  /** The request sounds like a photo while only Claude's drawing is available. */
  wantsPhoto: boolean
  start(): Promise<void>
  tryAgain(): Promise<void>
  /** "Try again" on one failed tile: only that version is drawn again. */
  retryVersion(version: number): Promise<void>
  keep(): Promise<void>
  /** Cancels a running job. Returns true when something was stopped. */
  stop(): boolean
}

const PHOTO_WORDS = /\b(photo|photograph|photographic|photorealistic|realistic)\b/i
const waiting = (count: number): VersionView[] =>
  Array.from({ length: count }, (_, i) => ({ index: i + 1, state: 'waiting' as const }))

/**
 * A8: the request, the job and the versions. `basedOn` are the ticked cards. Progress arrives on `assets:make:progress`; a job's events are only used for its own id.
 */
export function useMakeNew(basedOn: readonly AssetSummary[]): MakeNew {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const [mode, setMode] = useState<MakeModeInfo | null>(null)
  const [prompt, setPrompt] = useState('')
  const [versions, setVersions] = useState<MakeVersions>(4)
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState<MakeProgress | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setNameState] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [keeping, setKeeping] = useState(false)
  const touched = useRef(false)
  const job = useRef<string | null>(null)
  const early = useRef<MakeProgress | null>(null)
  const running = useRef(false)
  /** A single version is being drawn again: its own answer tells her why, so progress stays quiet. */
  const retrying = useRef(false)

  useEffect(() => {
    let alive = true
    client['make:mode']()
      .then((info) => alive && setMode(info))
      .catch(() => alive && setMode({ mode: 'unavailable', modelLabel: null, perPictureUsd: null }))
    return () => {
      alive = false
    }
  }, [client])

  const kind = useMemo(() => commonKind(basedOn.map((a) => a.kind)), [basedOn])
  const busy =
    starting || (jobId !== null && progress?.stage !== 'done' && progress?.stage !== 'error')
  useEffect(() => {
    running.current = busy
  }, [busy])

  const apply = useCallback(
    (update: MakeProgress): void => {
      setProgress(update)
      if (update.stage === 'error' && !retrying.current) {
        toast.show({
          message: update.error?.message ?? 'Couldn’t make that. Please try again.',
          tone: 'error'
        })
      }
    },
    [toast]
  )

  useEvent<AssetsEvents, 'make:progress'>(MODULE_ID, 'make:progress', (update) => {
    if (job.current === update.jobId) apply(update)
    else early.current = update
  })

  // A job that is still running when the page goes away is stopped: nothing is saved.
  useEffect(
    () => () => {
      if (running.current && job.current) void client['make:cancel']({ jobId: job.current })
    },
    [client]
  )

  const reset = useCallback(() => {
    job.current = null
    early.current = null
    setJobId(null)
    setProgress(null)
    setSelected(null)
    setNameError(undefined)
  }, [])

  const start = useCallback(async () => {
    if (prompt.trim() === '' || mode?.mode === 'unavailable' || starting) return
    if (job.current && running.current) void client['make:cancel']({ jobId: job.current })
    reset()
    setStarting(true)
    try {
      const result = await client['make:start']({
        basedOn: basedOn.map((asset) => asset.id),
        prompt: prompt.trim(),
        versions,
        kind
      })
      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return
      }
      job.current = result.jobId
      setJobId(result.jobId)
      if (!touched.current) setNameState(suggestMakeName(prompt, kind))
      const seen = early.current
      if (seen && seen.jobId === result.jobId) apply(seen)
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
    } finally {
      setStarting(false)
    }
  }, [prompt, mode, starting, client, reset, basedOn, versions, kind, toast, apply])

  const stop = useCallback((): boolean => {
    if (!running.current || !job.current) return false
    void client['make:cancel']({ jobId: job.current })
    reset()
    return true
  }, [client, reset])

  const setName = useCallback((next: string) => {
    touched.current = true
    setNameState(next)
  }, [])

  // The live name check, like every name.
  const settledName = useDebounced(name, 150)
  useEffect(() => {
    if (!jobId || settledName === '') return setNameError(undefined)
    let alive = true
    client
      .checkName({ name: settledName })
      .then((check) => alive && setNameError(check.ok ? undefined : check.message))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client, jobId, settledName])

  const keep = useCallback(async () => {
    if (!jobId || selected === null || nameError || keeping) return
    setKeeping(true)
    try {
      const result = await client['make:keep']({ jobId, version: selected, name, kind })
      if (!result.ok) {
        if (result.code === 'invalid-input') setNameError(result.message)
        else toast.show({ message: result.message, tone: 'error' })
        return
      }
      toast.show({ message: `${result.asset.name} added to Your assets` })
      reset()
      touched.current = false
      setPrompt('')
      setNameState('')
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
    } finally {
      setKeeping(false)
    }
  }, [jobId, selected, nameError, keeping, client, name, kind, toast, reset])

  const retryVersion = useCallback(
    async (version: number): Promise<void> => {
      if (!jobId) return
      retrying.current = true
      try {
        const result = await client['make:retry']({ jobId, version })
        if (!result.ok) toast.show({ message: result.message, tone: 'error' })
      } catch {
        toast.show({ message: COULDNT_SAVE, tone: 'error' })
      } finally {
        retrying.current = false
      }
    },
    [client, jobId, toast]
  )

  const versionViews = useMemo<VersionView[] | null>(() => {
    if (!jobId) return starting ? waiting(versions) : null
    const made = progress?.versions ?? []
    const failedAll = progress?.stage === 'error'
    const base =
      made.length > 0 ? made : waiting(versions).map((v) => ({ ...v, thumbDataUrl: null }))
    return base.map((v) => ({
      index: v.index,
      state: failedAll && v.state === 'waiting' ? 'failed' : v.state,
      thumbSrc: v.thumbDataUrl
    }))
  }, [jobId, starting, progress, versions])

  return {
    mode,
    prompt,
    setPrompt,
    versions,
    setVersions,
    busy,
    versionViews,
    stageLabel:
      progress?.stage === 'describing' || !progress ? 'Looking at your pictures…' : 'Drawing…',
    selected,
    select: setSelected,
    name,
    setName,
    nameError,
    keeping,
    wantsPhoto: mode?.mode === 'vector' && PHOTO_WORDS.test(prompt),
    start,
    tryAgain: start,
    retryVersion,
    keep,
    stop
  }
}
