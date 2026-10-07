import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { useToast } from '@ui/overlays'
import {
  DECK_BUILDER,
  type DeckBuilderApi,
  type HistoryState,
  type LessonView
} from '@shared/contracts/deck-builder'
import type {
  AttachmentRef,
  ChatItem,
  ChatSendArgs,
  RegionDraft,
  StartedJob
} from '@shared/contracts/deck-builder-chat'
import type { ChatAssetRef } from '@shared/assets/types'
import type { Deck } from '@shared/deck/types'
import type { ErrorCode } from '@shared/result'
import { errorFromFailure } from './errors'
import { sentRegions } from './regions'
import type { SessionContext } from './session'
import {
  initialTranscript,
  liveTurn,
  transcriptEntries,
  type PluginRequest
} from './transcriptState'
import { useChatEvents } from './useChatEvents'
import { useResultActions } from './useResultActions'
import { useTranscript } from './useTranscript'

export interface ChatSessionArgs {
  lessonId: string
  deck: Deck
  initialChat: ChatItem[]
  runningJob: LessonView['runningJob']
  currentSlideId: string | null
  /** Circled regions waiting to be sent. */
  regions: RegionDraft[]
  /** No usable API key: sending shows the Connect Claude prompt instead. */
  needsKey: boolean
  onLessonChanged(change: { deck: Deck; history: HistoryState }): void
  /** The editor's own copy of the history, when it passes one. */
  history?: HistoryState
}

/** What she typed and attached, ready to send. */
export interface Draft {
  text: string
  attachments: AttachmentRef[]
  /** One per distinct `{{name}}` chip in the text. */
  assetRefs?: ChatAssetRef[]
}

const historyKey = (h: HistoryState | null | undefined): string =>
  `${h?.undoChangeSetId ?? ''}|${h?.redoChangeSetId ?? ''}`

const liveOf = (job: LessonView['runningJob']) =>
  job ? liveTurn({ kind: job.kind, jobId: job.jobId, messageId: job.messageId }) : null

let echoCounter = 0

/**
 * The chat panel's brain: the transcript (stored messages + the live turn), sending, stopping, retrying,
 * Undo/Redo on result chips and keeping the editor's deck in step. Components only render what it returns.
 */
export function useChatSession(args: ChatSessionArgs) {
  const { lessonId, deck, regions, currentSlideId, needsKey } = args
  const client = useClient<DeckBuilderApi>(DECK_BUILDER)
  const toast = useToast()
  const store = useTranscript(() => initialTranscript(args.initialChat, liveOf(args.runningJob)))
  const { dispatch, getState } = store
  const deckRef = useRef(deck)
  const latest = useRef(args)
  latest.current = args
  const [ownHistory, setOwnHistory] = useState<HistoryState | null>(null)
  const ownKey = useRef(historyKey(args.history))
  const lastSend = useRef<ChatSendArgs | null>(null)
  const history = args.history ?? ownHistory

  useEffect(() => {
    deckRef.current = deck
  }, [deck])

  const remember = useCallback((next: HistoryState) => {
    ownKey.current = historyKey(next)
    setOwnHistory(next)
  }, [])

  const commit = useCallback(
    (view: { deck: Deck; history: HistoryState }) => {
      deckRef.current = view.deck
      remember(view.history)
      latest.current.onLessonChanged(view)
    },
    [remember]
  )

  const sync = useCallback(async (): Promise<LessonView | null> => {
    try {
      const view = await client.openLesson({ lessonId })
      if (!view.ok) return null
      dispatch({ type: 'synced', items: view.chat })
      remember(view.history)
      return view
    } catch {
      return null
    }
  }, [client, lessonId, dispatch, remember])

  const ctx: SessionContext = { client, lessonId, dispatch, getState, deckRef, commit, sync, toast }
  useChatEvents(ctx)
  const results = useResultActions(ctx)

  // A different lesson: start over from what the editor loaded.
  const shownLesson = useRef(lessonId)
  useEffect(() => {
    if (shownLesson.current === lessonId) return
    shownLesson.current = lessonId
    dispatch({
      type: 'reset',
      items: latest.current.initialChat,
      live: liveOf(latest.current.runningJob)
    })
  }, [lessonId, dispatch])

  // Without the editor's history, ask once; with it, re-read the chips when someone else undid or redid.
  useEffect(() => {
    if (args.history) return
    void client
      .openLesson({ lessonId })
      .then((view) => view.ok && setOwnHistory(view.history))
      .catch(() => undefined)
  }, [client, lessonId, args.history])
  useEffect(() => {
    if (!args.history || historyKey(args.history) === ownKey.current || getState().live) return
    ownKey.current = historyKey(args.history)
    void sync()
  }, [args.history, getState, sync])

  const fail = useCallback(
    (failure: { code: ErrorCode; message: string }): void => {
      const error = errorFromFailure(failure)
      const item: ChatItem = {
        id: `local:error-${(echoCounter += 1)}`,
        role: 'assistant',
        at: new Date().toISOString(),
        text: '',
        error
      }
      dispatch({ type: 'add-local', entry: { kind: 'message', item } })
    },
    [dispatch]
  )

  /** Calls `chat:send` for `sendArgs`, showing her message at once. */
  const run = useCallback(
    async (sendArgs: ChatSendArgs, attachments: AttachmentRef[]): Promise<boolean> => {
      const echoId = `local:user-${(echoCounter += 1)}`
      const echo: ChatItem = {
        id: echoId,
        role: 'user',
        at: new Date().toISOString(),
        text: sendArgs.text,
        ...(sendArgs.assetRefs.length ? { assets: sendArgs.assetRefs } : {}),
        ...(attachments.length ? { attachments } : {}),
        ...(sendArgs.regions.length
          ? { regions: sentRegions(sendArgs.regions, deckRef.current, sendArgs.text) }
          : {})
      }
      dispatch({ type: 'add-local', entry: { kind: 'message', item: echo } })
      dispatch({ type: 'start', turn: { kind: 'chat' } })
      lastSend.current = sendArgs
      try {
        const started = await client['chat:send'](sendArgs)
        if (started.ok) {
          dispatch({ type: 'job-started', jobId: started.jobId, messageId: started.messageId })
          return true
        }
        dispatch({ type: 'remove-local', id: echoId })
        dispatch({ type: 'drop-live' })
        fail(started)
      } catch {
        dispatch({ type: 'remove-local', id: echoId })
        dispatch({ type: 'drop-live' })
        fail({ code: 'unknown', message: 'Something went wrong. Try again.' })
      }
      return false
    },
    [client, dispatch, fail]
  )

  /** Sends her draft. Returns false when nothing was sent, so the Composer can keep or restore it. */
  const send = useCallback(
    async (draft: Draft): Promise<boolean> => {
      if (needsKey) {
        const prompted = getState().local.some((l) => l.entry.kind === 'key-prompt')
        if (!prompted)
          dispatch({ type: 'add-local', entry: { kind: 'key-prompt', id: 'key-prompt' } })
        return false
      }
      return run(
        {
          lessonId,
          text: draft.text.trim(),
          attachmentIds: draft.attachments.map((a) => a.id),
          regions,
          markup: [],
          selectedSlideId: currentSlideId ?? deckRef.current.slides[0]?.id ?? '',
          assetRefs: draft.assetRefs ?? []
        },
        draft.attachments
      )
    },
    [needsKey, getState, dispatch, run, lessonId, regions, currentSlideId]
  )

  /** "Try again" after a chat error: the same message, sent again. */
  const resend = useCallback(async (): Promise<void> => {
    const previous = lastSend.current
    if (previous) await run(previous, [])
  }, [run])

  /** "Finish the rest" after a stopped or failed generation. */
  const finishGeneration = useCallback(async (): Promise<void> => {
    dispatch({ type: 'start', turn: { kind: 'generation' } })
    try {
      const started = await client.finishGeneration({ lessonId })
      if (started.ok)
        return dispatch({ type: 'job-started', jobId: started.jobId, messageId: started.messageId })
      dispatch({ type: 'drop-live' })
      toast.show({ message: started.message, tone: 'error' })
    } catch {
      dispatch({ type: 'drop-live' })
    }
  }, [client, lessonId, dispatch, toast])

  const stop = useCallback((): void => {
    const live = getState().live
    if (!live?.jobId) return
    dispatch({ type: 'stopping' })
    const jobId = live.jobId
    if (live.kind === 'plugin') void client['plugins:cancel']({ jobId })
    else if (live.kind === 'generation') void client.cancel({ jobId })
    else void client['chat:cancel']({ jobId })
  }, [client, getState, dispatch])

  /** A plugin run is about to start: show the request and wait for its job. */
  const startPlugin = useCallback(
    (request: PluginRequest): void => {
      dispatch({ type: 'add-local', entry: { kind: 'request', request } })
      dispatch({ type: 'start', turn: { kind: 'plugin', pluginId: request.pluginId } })
    },
    [dispatch]
  )
  const pluginStarted = useCallback(
    (job: StartedJob): void => dispatch({ type: 'job-started', ...job }),
    [dispatch]
  )
  const pluginFailed = useCallback(
    (requestId: string): void => {
      dispatch({ type: 'remove-local', id: requestId })
      dispatch({ type: 'drop-live' })
    },
    [dispatch]
  )

  const entries = useMemo(() => transcriptEntries(store.state), [store.state])

  return {
    entries,
    live: store.state.live,
    busy: store.state.live !== null,
    history,
    results,
    send,
    stop,
    resend,
    finishGeneration,
    startPlugin,
    pluginStarted,
    pluginFailed
  }
}
