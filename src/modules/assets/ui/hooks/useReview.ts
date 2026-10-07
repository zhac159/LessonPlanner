import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient, useEvent } from '@renderer/sdk'
import type { AssetKind } from '@shared/assets/types'
import type {
  AssetsEvents,
  ReviewCandidate,
  ReviewEdit,
  ReviewView as ReviewData
} from '@shared/contracts/assets'
import { useToast } from '@ui/overlays'
import type { ReviewView as ReviewShow } from '@ui/assets'
import { MODULE_ID, type AssetsFullApi } from '../../shared'
import { COULDNT_SAVE, addedToLibrary } from '../model/messages'

export interface ReviewState {
  data: ReviewData | null
  status: 'loading' | 'ready' | 'error'
  show: ReviewShow
  setShow(show: ReviewShow): void
  /** The candidates the "All / Keeping / Left out" pills show. */
  candidates: ReviewCandidate[]
  found: number
  keeping: number
  /** Name messages by candidate id (a taken or invalid name). */
  nameErrors: Record<string, string>
  /** The first candidate with a name problem: Keep waits for it. */
  firstProblem: ReviewCandidate | null
  setKeep(id: string, keep: boolean): void
  setName(id: string, name: string): void
  setKind(id: string, kind: AssetKind): void
  /** Saves the ticked ones; resolves true when they went into the library. */
  accept(): Promise<boolean>
  /** "Try again" on a file that could not be read; main reads it again and the row follows. */
  retryFile(batchId: string, fileId: string): Promise<void>
  /** Throws every waiting batch away. */
  dismiss(): Promise<boolean>
  busy: boolean
}

/** A2: everything waiting for review, live; edits apply at once and are confirmed by main. */
export function useReview(onAccepted: (count: number) => void): ReviewState {
  const client = useClient<AssetsFullApi>(MODULE_ID)
  const toast = useToast()
  const [data, setData] = useState<ReviewData | null>(null)
  const [status, setStatus] = useState<ReviewState['status']>('loading')
  const [show, setShow] = useState<ReviewShow>('all')
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const latest = useRef<ReviewData | null>(null)

  const put = useCallback((next: ReviewData): void => {
    latest.current = next
    setData(next)
    setStatus('ready')
    setNameErrors((errors) => {
      const alive = new Set(next.candidates.map((c) => c.id))
      return Object.fromEntries(Object.entries(errors).filter(([id]) => alive.has(id)))
    })
  }, [])

  useEffect(() => {
    let alive = true
    client['review:get']()
      .then((view) => alive && put(view))
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [client, put])
  useEvent<AssetsEvents, 'review:changed'>(MODULE_ID, 'review:changed', put)

  const replace = useCallback((candidate: ReviewCandidate): void => {
    setData((view) =>
      view
        ? {
            ...view,
            candidates: view.candidates.map((c) => (c.id === candidate.id ? candidate : c))
          }
        : view
    )
  }, [])

  const edit = useCallback(
    async (change: ReviewEdit, optimistic?: Partial<ReviewCandidate>): Promise<void> => {
      const before = latest.current?.candidates.find((c) => c.id === change.candidateId)
      if (before && optimistic) replace({ ...before, ...optimistic })
      const result = await client['review:edit'](change).catch(() => null)
      if (result?.ok) {
        replace(result.candidate)
        setNameErrors((errors) => {
          const rest = { ...errors }
          delete rest[change.candidateId]
          return rest
        })
        return
      }
      if (before && optimistic) replace(before)
      if (result && result.code === 'invalid-input' && change.name !== undefined) {
        setNameErrors((errors) => ({ ...errors, [change.candidateId]: result.message }))
      } else {
        toast.show({ message: result ? result.message : COULDNT_SAVE, tone: 'error' })
      }
    },
    [client, replace, toast]
  )

  const accept = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await client['review:accept']({})
      if (!result.ok) {
        toast.show({ message: result.message, tone: 'error' })
        return false
      }
      const added = result.added
      toast.show({
        message: addedToLibrary(added.length),
        action: {
          label: 'Undo',
          onAction: () => {
            void Promise.all(added.map((asset) => client.remove({ assetId: asset.id }))).catch(() =>
              toast.show({ message: COULDNT_SAVE, tone: 'error' })
            )
          }
        }
      })
      onAccepted(added.length)
      return true
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }, [client, onAccepted, toast])

  const dismiss = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    try {
      const results = await Promise.all(
        (latest.current?.batches ?? []).map((batch) =>
          client['review:dismiss']({ batchId: batch.id })
        )
      )
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) {
        toast.show({ message: failed.message, tone: 'error' })
        return false
      }
      return true
    } catch {
      toast.show({ message: COULDNT_SAVE, tone: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }, [client, toast])

  const retryFile = useCallback(
    async (batchId: string, fileId: string): Promise<void> => {
      try {
        const result = await client['review:retry']({ batchId, fileId })
        if (!result.ok) toast.show({ message: result.message, tone: 'error' })
      } catch {
        toast.show({ message: COULDNT_SAVE, tone: 'error' })
      }
    },
    [client, toast]
  )

  const all = useMemo(() => data?.candidates ?? [], [data])
  const candidates = useMemo(
    () => (show === 'all' ? all : all.filter((c) => (show === 'keeping' ? c.keep : !c.keep))),
    [all, show]
  )
  const keeping = all.filter((c) => c.keep).length
  const firstProblem = all.find((c) => nameErrors[c.id]) ?? null

  return {
    data,
    status: status === 'error' && !data ? 'error' : status,
    show,
    setShow,
    candidates,
    found: Math.max(data?.found ?? 0, all.length),
    keeping,
    nameErrors,
    firstProblem,
    setKeep: (id, keep) => void edit({ candidateId: id, keep }, { keep }),
    setName: (id, name) => void edit({ candidateId: id, name }),
    setKind: (id, kind) => void edit({ candidateId: id, kind }, { kind }),
    accept,
    retryFile,
    dismiss,
    busy
  }
}
