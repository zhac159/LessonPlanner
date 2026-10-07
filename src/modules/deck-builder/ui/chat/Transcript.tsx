import type { ReactNode } from 'react'
import { Callout, Button } from '@ui/atoms'
import { MessageAssistant, MessageProgress } from '@ui/chat'
import type { Deck } from '@shared/deck/types'
import type { HistoryState } from '@shared/contracts/deck-builder'
import { PluginRequestBubble } from '../plugins/PluginRequestBubble'
import { MessageRow, type RowActions } from './MessageRow'
import { runningStep, type Entry, type LiveTurn } from './transcriptState'

export const KEY_PROMPT = 'Connect Claude to use this.'

const DEFAULT_LABEL: Record<LiveTurn['kind'], string> = {
  chat: 'Working on it…',
  plugin: 'Working on it…',
  generation: 'Making your slides…'
}

export interface TranscriptProps {
  entries: Entry[]
  live: LiveTurn | null
  deck: Pick<Deck, 'slides'>
  history: HistoryState | null
  busyChangeSetId: string | null
  actions: RowActions
  onStop(): void
  onConnectClaude(): void
  renderText?: (text: string) => ReactNode
  spots?: { count: number; onFillFirst(): void }
}

/** The messages, then the turn that is still arriving (progress first, the reply once its text streams in). */
export function Transcript({
  entries,
  live,
  deck,
  history,
  busyChangeSetId,
  actions,
  onStop,
  onConnectClaude,
  renderText,
  spots
}: TranscriptProps) {
  const running = live ? runningStep(live.steps) : undefined
  return (
    <>
      {entries.map((entry) => {
        if (entry.kind === 'message') {
          return (
            <MessageRow
              key={entry.item.id}
              item={entry.item}
              deck={deck}
              history={history}
              busyChangeSetId={busyChangeSetId}
              actions={actions}
              renderText={renderText}
              spots={spots}
            />
          )
        }
        if (entry.kind === 'request') {
          return <PluginRequestBubble key={entry.request.id} request={entry.request} />
        }
        return (
          <Callout
            key={entry.id}
            variant="action"
            action={
              <Button size="sm" variant="primary" onClick={onConnectClaude}>
                Connect Claude
              </Button>
            }
          >
            {KEY_PROMPT}
          </Callout>
        )
      })}
      {live &&
        (live.text ? (
          <MessageAssistant text={live.text} renderInline={renderText} streaming />
        ) : (
          <MessageProgress
            label={
              live.stopping
                ? 'Stopping…'
                : (live.progress?.label ?? running?.label ?? DEFAULT_LABEL[live.kind])
            }
            steps={live.steps.filter((step) => step !== running)}
            progress={
              live.progress && live.progress.max > 0
                ? {
                    value: live.progress.value,
                    max: live.progress.max,
                    // The card's title already says what is happening: the bar only counts.
                    label: `${live.progress.value} of ${live.progress.max} done`
                  }
                : undefined
            }
            onStop={live.jobId && !live.stopping ? onStop : undefined}
          />
        ))}
    </>
  )
}
