/** Stored records -> what the ChatPanel shows (06 §6). Labels and Undo state come from the lesson's journal. */
import type { ChatItem } from '@shared/contracts/deck-builder-chat'
import type { ChangeSet } from '@shared/deck/types'
import { describeChanges } from './changeLabel'
import type { ChatRecord } from './records'

export type ChangeLookup = ReadonlyMap<string, { changeSet: ChangeSet; undone: boolean }>

/** Every ChangeSet id the records mention (to look them up in one go). */
export const changeSetIdsOf = (records: readonly ChatRecord[]): string[] => [
  ...new Set(records.flatMap((r) => r.ui.changeSetIds ?? []))
]

/**
 * One record as a ChatItem. The ResultChip points at the LAST change of the message (the one Undo applies
 * to) and is labelled from all of them; a change that has left the history gives no chip.
 */
export function toChatItem(
  record: ChatRecord,
  changes: ChangeLookup,
  deckSlideIds: readonly string[]
): ChatItem {
  const { ui } = record
  const found = (ui.changeSetIds ?? []).flatMap((id) => changes.get(id) ?? [])
  const last = found.at(-1)
  const described = last
    ? describeChanges(
        found.map((f) => f.changeSet),
        deckSlideIds
      )
    : undefined
  return {
    id: record.id,
    role: record.role,
    at: record.at,
    text: ui.text,
    ...(ui.attachments?.length ? { attachments: ui.attachments } : {}),
    ...(ui.regions?.length ? { regions: ui.regions } : {}),
    ...(last && described
      ? {
          result: {
            changeSetId: last.changeSet.id,
            label: described.label,
            slideIds: described.slideIds,
            undone: last.undone
          }
        }
      : {}),
    ...(ui.file ? { file: ui.file } : {}),
    ...(ui.error ? { error: ui.error } : {}),
    ...(ui.pluginId ? { pluginId: ui.pluginId } : {}),
    ...(ui.assets?.length ? { assets: ui.assets } : {}),
    ...(ui.showSpots ? { showSpots: true } : {})
  }
}
