/**
 * The chat transcript as plain data: stored messages (from main), a few local entries that main does not
 * store (the optimistic copy of what she just sent, plugin request bubbles, the Connect Claude prompt) and
 * the one live turn that is streaming in. Pure, so the streaming rules are unit-tested without React.
 */
import type { ProgressStepItem } from '../../../../renderer/src/ui/chat/MessageProgress/steps'
import type { JobKind } from '@shared/contracts/deck-builder'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { PluginTint } from '@shared/contracts/deck-builder-plugins'
import { STOPPED } from '@shared/ai/errors'

/** The job running for this lesson, shown as a MessageProgress (and, once text arrives, a streaming reply). */
export interface LiveTurn {
  /** Null until `chat:send` / `plugins:run` has answered (events can arrive first). */
  jobId: string | null
  messageId: string | null
  kind: JobKind
  /** The reply streamed so far. */
  text: string
  steps: ProgressStepItem[]
  /** Slide generation: how many slides are done. */
  progress: { value: number; max: number; label: string } | null
  /** Stop was pressed; the reply that ends the turn then reads "Stopped. Nothing was changed.". */
  stopping: boolean
  /** A change was committed during the turn: the deck needs refreshing at the end. */
  changed: boolean
  pluginId?: string
  file: ChatItem['file'] | null
}

/** "You asked the Quiz plugin for…": what a plugin run looks like as a request in the chat (07 §5). */
export interface PluginRequest {
  id: string
  pluginId: string
  title: string
  icon: string
  tint: PluginTint
  summary: string
}

export type Entry =
  | { kind: 'message'; item: ChatItem }
  | { kind: 'request'; request: PluginRequest }
  | { kind: 'key-prompt'; id: string }

export interface TranscriptState {
  /** What main stored, oldest first. */
  server: ChatItem[]
  /** Entries main does not store, each placed after the stored message that was last when it was added. */
  local: Array<{ after: string | null; entry: Entry }>
  live: LiveTurn | null
}

export type TranscriptAction =
  | { type: 'reset'; items: ChatItem[]; live: LiveTurn | null }
  | { type: 'synced'; items: ChatItem[] }
  | { type: 'add-local'; entry: Entry }
  | { type: 'remove-local'; id: string }
  | { type: 'start'; turn: Pick<LiveTurn, 'kind'> & Partial<LiveTurn> }
  | { type: 'job-started'; jobId: string; messageId: string }
  | { type: 'delta'; messageId: string; text: string }
  | { type: 'status'; messageId: string; step: string; state: ProgressStepItem['state'] }
  | { type: 'progress'; value: number; max: number; label: string; step?: string }
  | { type: 'changed' }
  | { type: 'file'; file: NonNullable<ChatItem['file']> }
  | { type: 'stopping' }
  | { type: 'finish'; error?: ChatItem['error']; at: string }
  | { type: 'drop-live' }
  | { type: 'set-undone'; changeSetId: string; undone: boolean }

/** A fresh live turn. */
export function liveTurn(init: Pick<LiveTurn, 'kind'> & Partial<LiveTurn>): LiveTurn {
  return {
    jobId: null,
    messageId: null,
    text: '',
    steps: [],
    progress: null,
    stopping: false,
    changed: false,
    file: null,
    ...init
  }
}

export const initialTranscript = (items: ChatItem[], live: LiveTurn | null): TranscriptState => ({
  server: items,
  local: [],
  live
})

/** Is this event for the turn we are showing? (`messageId` is unknown until the start call answered.) */
const mine = (live: LiveTurn | null, messageId: string): live is LiveTurn =>
  live !== null && (live.messageId === null || live.messageId === messageId)

/**
 * Records a progress step: a known step changes state, a new one is added and earlier running steps
 * count as done (Claude does not always send "done" before the next step).
 */
export function upsertStep(
  steps: ProgressStepItem[],
  step: string,
  state: ProgressStepItem['state']
): ProgressStepItem[] {
  const known = steps.findIndex((s) => s.label === step)
  if (known >= 0) return steps.map((s, i) => (i === known ? { ...s, state } : s))
  const settled = steps.map((s) => (s.state === 'running' ? { ...s, state: 'done' as const } : s))
  return [...settled, { label: step, state }]
}

/** The step that is under way now (it is the progress label), if any. */
export function runningStep(steps: ProgressStepItem[]): ProgressStepItem | undefined {
  for (let i = steps.length - 1; i >= 0; i -= 1) if (steps[i].state === 'running') return steps[i]
  return undefined
}

const lastServerId = (state: TranscriptState): string | null => state.server.at(-1)?.id ?? null

function withUndone(items: ChatItem[], changeSetId: string, undone: boolean): ChatItem[] {
  return items.map((item) =>
    item.result?.changeSetId === changeSetId
      ? { ...item, result: { ...item.result, undone } }
      : item
  )
}

/** The live turn turned into a message (what stays on screen until main's stored copy replaces it). */
function finishedMessage(
  live: LiveTurn,
  error: ChatItem['error'] | undefined,
  at: string
): ChatItem {
  const stopped = live.stopping && !live.changed && !live.text && !error
  return {
    id: live.messageId ?? `local:turn-${at}`,
    role: 'assistant',
    at,
    text: live.text || (stopped ? STOPPED : ''),
    ...(live.file ? { file: live.file } : {}),
    ...(live.pluginId ? { pluginId: live.pluginId } : {}),
    ...(error ? { error } : {})
  }
}

export function transcriptReducer(
  state: TranscriptState,
  action: TranscriptAction
): TranscriptState {
  const { live } = state
  switch (action.type) {
    case 'reset':
      return initialTranscript(action.items, action.live)
    case 'synced':
      // The stored copy replaces the local messages; requests and prompts stay where they were put. A
      // finished reply main did not store (its id is real) stays, so nothing she saw vanishes.
      return {
        ...state,
        server: action.items,
        local: state.local.filter(
          (l) =>
            l.entry.kind !== 'message' || live !== null || !l.entry.item.id.startsWith('local:')
        )
      }
    case 'add-local':
      return {
        ...state,
        local: [...state.local, { after: lastServerId(state), entry: action.entry }]
      }
    case 'remove-local':
      return {
        ...state,
        local: state.local.filter((l) => !localHasId(l.entry, action.id))
      }
    case 'start':
      // A job may announce itself (events) before the call that started it answers: keep what it sent.
      return {
        ...state,
        local: state.local.filter((l) => l.entry.kind !== 'key-prompt'),
        live: live ? { ...live, ...definedOnly(action.turn) } : liveTurn(action.turn)
      }
    case 'job-started':
      return live
        ? {
            ...state,
            live: {
              ...live,
              jobId: live.jobId ?? action.jobId,
              messageId: live.messageId ?? action.messageId
            }
          }
        : state
    case 'delta':
      return mine(live, action.messageId)
        ? {
            ...state,
            live: { ...live, messageId: action.messageId, text: live.text + action.text }
          }
        : state
    case 'status':
      return mine(live, action.messageId)
        ? {
            ...state,
            live: {
              ...live,
              messageId: action.messageId,
              steps: upsertStep(live.steps, action.step, action.state)
            }
          }
        : state
    case 'progress':
      return live
        ? {
            ...state,
            live: {
              ...live,
              progress: { value: action.value, max: action.max, label: action.label },
              steps: action.step ? upsertStep(live.steps, action.step, 'running') : live.steps
            }
          }
        : state
    case 'changed':
      return live ? { ...state, live: { ...live, changed: true } } : state
    case 'file':
      return live ? { ...state, live: { ...live, file: action.file } } : state
    case 'stopping':
      return live ? { ...state, live: { ...live, stopping: true } } : state
    case 'finish':
      if (!live) return state
      return {
        ...state,
        live: null,
        local: [
          ...state.local,
          {
            after: lastServerId(state),
            entry: { kind: 'message', item: finishedMessage(live, action.error, action.at) }
          }
        ]
      }
    case 'drop-live':
      return { ...state, live: null }
    case 'set-undone':
      return {
        ...state,
        server: withUndone(state.server, action.changeSetId, action.undone),
        local: state.local.map((l) =>
          l.entry.kind === 'message'
            ? {
                ...l,
                entry: {
                  kind: 'message',
                  item: withUndone([l.entry.item], action.changeSetId, action.undone)[0]
                }
              }
            : l
        )
      }
  }
}

const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>

function localHasId(entry: Entry, id: string): boolean {
  if (entry.kind === 'message') return entry.item.id === id
  if (entry.kind === 'request') return entry.request.id === id
  return entry.id === id
}

/** What the transcript shows, oldest first (the live turn is rendered after these). */
export function transcriptEntries(state: TranscriptState): Entry[] {
  const stored = new Set(state.server.map((item) => item.id))
  const locals = state.local.filter(
    (l) => !(l.entry.kind === 'message' && stored.has(l.entry.item.id))
  )
  const known = new Set<string | null>([null, ...stored])
  const out: Entry[] = locals.filter((l) => l.after === null).map((l) => l.entry)
  for (const item of state.server) {
    out.push({ kind: 'message', item })
    out.push(...locals.filter((l) => l.after === item.id).map((l) => l.entry))
  }
  out.push(...locals.filter((l) => !known.has(l.after)).map((l) => l.entry))
  return out
}
