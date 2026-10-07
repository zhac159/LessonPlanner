import { useCallback, useEffect, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import { buildCreateRequest, validateDraft, type LessonDraft } from '../buildRequest'

export type CreateKind = 'generate' | 'blank'

export const CREATE_FAILED = 'I couldn’t start your lesson. Try again.'

export interface CreateLessonState {
  /** Which button is working, or null. */
  creating: CreateKind | null
  /** A readable reason the lesson was not made, or null. */
  error: string | null
  /** The error comes from a failed attempt (not from missing input), so "Try again" makes sense. */
  retryable: boolean
  /** The last attempt failed because Claude could not be reached. */
  networkFailed: boolean
  /** "Make my slides" was pressed with no key: show the Connect Claude prompt, send nothing. */
  needsKey: boolean
  /** Make my slides, or Blank slide. The draft stays on screen until the lesson exists. */
  submit(kind: CreateKind): Promise<void>
  /** Runs the last attempt again ("Try again"). */
  retry(): Promise<void>
  dismissError(): void
}

/**
 * Creates the lesson (`createLesson`) and hands it to the editor (05 §8.8, §8.10). Nothing is saved
 * before this runs; with no key "Make my slides" only shows the Connect Claude prompt.
 */
export function useCreateLesson(options: {
  draft: LessonDraft
  /** Null while unknown: main then answers for itself. */
  aiReady: boolean | null
  onCreated(lessonId: string): void
  /** Called once a lesson was made from the set-up chips, to save them as defaults. */
  onRemember?(): void
}): CreateLessonState {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [creating, setCreating] = useState<CreateKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [networkFailed, setNetworkFailed] = useState(false)
  const [retryable, setRetryable] = useState(false)
  const [needsKey, setNeedsKey] = useState(false)
  const busy = useRef(false)
  const lastKind = useRef<CreateKind>('generate')
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  // Connecting Claude (Settings, then back) clears the prompt.
  useEffect(() => {
    if (options.aiReady) setNeedsKey(false)
  }, [options.aiReady])

  const submit = useCallback(
    async (kind: CreateKind) => {
      if (busy.current) return
      lastKind.current = kind
      const { draft, aiReady, onCreated, onRemember } = latest.current
      if (kind === 'generate') {
        const problem = validateDraft(draft)
        if (problem) {
          setRetryable(false)
          return setError(problem)
        }
        if (aiReady === false) return setNeedsKey(true)
      }
      busy.current = true
      setCreating(kind)
      setError(null)
      setNetworkFailed(false)
      setNeedsKey(false)
      try {
        const created = await deckBuilder.createLesson(buildCreateRequest(draft, kind))
        if (created.ok) {
          onRemember?.()
          onCreated(created.lessonId)
        } else {
          setError(created.message)
          setRetryable(true)
          setNetworkFailed(created.code === 'network')
        }
      } catch {
        setError(CREATE_FAILED)
        setRetryable(true)
      } finally {
        busy.current = false
        setCreating(null)
      }
    },
    [deckBuilder]
  )

  const retry = useCallback(() => submit(lastKind.current), [submit])

  return {
    creating,
    error,
    retryable,
    networkFailed,
    needsKey,
    submit,
    retry,
    dismissError: () => setError(null)
  }
}
