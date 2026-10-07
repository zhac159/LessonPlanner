import { useCallback } from 'react'
import { useClient } from '@renderer/sdk'
import type { PlaceAssetArgs } from '@shared/assets/place'
import { DECK_BUILDER, type EditorApi, type PlaceAssetResult } from '@shared/contracts/deck-builder'
import { applyChangeSet } from '@shared/deck/apply'
import type { UseLesson } from '../../editor/hooks/useLesson'

export type PlaceOutcome = { ok: true; result: PlaceAssetResult } | { ok: false; message: string }

export const COULDNT_GET_PICTURE = 'Couldn’t get that picture. Try another or search again.'

/**
 * `deck-builder:placeAsset`: ONE ChangeSet in main (it saves online and made pictures into the library, copies the file
 * into the lesson, fits it, adds the credit line). The editor applies the same ChangeSet to its own deck, so the stage
 * updates at once, and the chat message main stored shows up when the chat re-reads (the history changed).
 */
export function usePlaceAsset(
  lessonId: string,
  lesson: Pick<UseLesson, 'latest' | 'commit' | 'refresh'>
) {
  const client = useClient<EditorApi>(DECK_BUILDER)
  const { latest, commit, refresh } = lesson

  return useCallback(
    async (args: Omit<PlaceAssetArgs, 'lessonId'>): Promise<PlaceOutcome> => {
      try {
        const result = await client.placeAsset({ ...args, lessonId })
        if (!result.ok) {
          const fromOnline =
            args.source.kind === 'online' && !['not-found', 'invalid-input'].includes(result.code)
          return { ok: false, message: fromOnline ? COULDNT_GET_PICTURE : result.message }
        }
        const deck = latest.current?.deck
        const local = deck ? applyChangeSet(deck, result.changeSet, { allowLocked: true }) : null
        if (local?.ok) commit({ deck: local.deck, history: result.history })
        else await refresh()
        return { ok: true, result }
      } catch {
        return { ok: false, message: 'Couldn’t place that. Nothing was changed.' }
      }
    },
    [client, lessonId, latest, commit, refresh]
  )
}
