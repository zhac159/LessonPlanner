import type { ReactNode } from 'react'
import { SpotsCard } from '@ui/assets'
import {
  AttachmentCard,
  MessageAssistant,
  MessageUser,
  ResultChip,
  type RegionChipProps
} from '@ui/chat'
import type { HistoryState } from '@shared/contracts/deck-builder'
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { Deck } from '@shared/deck/types'
import type { SentHighlight } from '../circle/sentHighlight'
import { ERROR_ACTION_LABELS, isStopped } from './errors'
import { slideNumberOf } from './regions'
import { canRedoChange, canUndoChange } from './useResultActions'

/** Everything a message can do; the panel supplies it, the row only calls it. */
export interface RowActions {
  onUndo(changeSetId: string): void
  onRedo(changeSetId: string): void
  onHighlightSlides(slideIds: string[]): void
  onHighlightSent(region: SentHighlight | null): void
  onSelectSlide?(slideId: string): void
  onErrorAction(item: ChatItem): void
  onOpenFile(path: string): void
  onShowFile(path: string): void
}

export interface MessageRowProps {
  item: ChatItem
  deck: Pick<Deck, 'slides'>
  history: HistoryState | null
  /** The change whose Undo / Redo is in flight. */
  busyChangeSetId: string | null
  actions: RowActions
  /** Draws a run of text with its asset chips (A5). */
  renderText?: (text: string) => ReactNode
  /** The live count of empty spots, for the card under a message that left some (A12). */
  spots?: { count: number; onFillFirst(): void }
}

function regionChips(
  item: ChatItem,
  deck: Pick<Deck, 'slides'>,
  actions: RowActions
): Array<RegionChipProps & { id: string }> {
  return (item.regions ?? []).map((region) => {
    const current = slideNumberOf(deck, region.slideId)
    const id = `${item.id}:${region.n}`
    return {
      id,
      n: region.n,
      slideNumber: current ?? region.slideNumber,
      removed: current === null,
      onClick: actions.onSelectSlide && (() => actions.onSelectSlide?.(region.slideId)),
      onHighlight: (on: boolean) =>
        actions.onHighlightSent(
          on && current !== null
            ? {
                id,
                n: region.n,
                slideId: region.slideId,
                path: region.path,
                caption: region.caption
              }
            : null
        )
    }
  })
}

/** One stored message: hers as a lilac bubble, the buddy's as plain text with its chip and files. */
export function MessageRow({
  item,
  deck,
  history,
  busyChangeSetId,
  actions,
  renderText,
  spots
}: MessageRowProps) {
  if (item.role === 'user') {
    return (
      <MessageUser
        text={item.text}
        renderText={renderText}
        attachments={(item.attachments ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          sizeBytes: a.sizeBytes
        }))}
        regions={regionChips(item, deck, actions)}
      />
    )
  }

  const { error, result, file } = item
  const parts = [
    ...(item.text ? [{ text: item.text, error: undefined }] : []),
    ...(error ? [{ text: error.message, error }] : [])
  ]
  const extras = (
    <>
      {result && (
        <ResultChip
          label={result.label}
          undone={result.undone}
          canUndo={canUndoChange(history, result.changeSetId)}
          busy={busyChangeSetId === result.changeSetId}
          onUndo={() => actions.onUndo(result.changeSetId)}
          onRedo={
            canRedoChange(history, result.changeSetId)
              ? () => actions.onRedo(result.changeSetId)
              : undefined
          }
          onSelect={
            actions.onSelectSlide && result.slideIds[0]
              ? () => actions.onSelectSlide?.(result.slideIds[0])
              : undefined
          }
          onHighlight={(on) => actions.onHighlightSlides(on ? result.slideIds : [])}
        />
      )}
      {item.showSpots && spots && <SpotsCard count={spots.count} onFillFirst={spots.onFillFirst} />}
      {file && (
        <AttachmentCard
          name={file.name}
          kind={file.kind}
          icon="file-text"
          onOpen={() => actions.onOpenFile(file.path)}
          onShowInFolder={() => actions.onShowFile(file.path)}
        />
      )}
    </>
  )
  if (parts.length === 0) return <MessageAssistant>{extras}</MessageAssistant>
  return (
    <>
      {parts.map((part, i) => (
        <MessageAssistant
          key={i}
          text={part.text}
          renderInline={part.error ? undefined : renderText}
          variant={part.error && !isStopped(part.error) ? 'error' : 'normal'}
          action={
            part.error?.action
              ? {
                  label: ERROR_ACTION_LABELS[part.error.action],
                  onClick: () => actions.onErrorAction(item)
                }
              : undefined
          }
        >
          {i === parts.length - 1 && extras}
        </MessageAssistant>
      ))}
    </>
  )
}
