/**
 * Fake chat, assets part: "Put {{school_logo}} in the top right" places the asset through the caller's
 * `assets.place` exactly like the real `place_asset` tool (one ChangeSet), then answers in the voice of the mockup.
 */
import type { AiService, ChatSink, PlaceToolArgs } from '@shared/ai/types'
import { assetTokenNames } from '@shared/assets/tokens'
import type { Anchor } from '@shared/assets/types'

type ChatInput = Parameters<AiService['chatTurn']>[0]

const WORDS: Array<[RegExp, Anchor]> = [
  [/top[ -]?left/i, 'top-left'],
  [/top[ -]?right/i, 'top-right'],
  [/bottom[ -]?left/i, 'bottom-left'],
  [/bottom[ -]?right/i, 'bottom-right'],
  [/\bcentre\b|\bcenter\b|\bmiddle\b/i, 'center']
]

const SAYS: Record<string, string> = {
  'top-left': 'top-left corner',
  'top-right': 'top-right corner',
  'bottom-left': 'bottom-left corner',
  'bottom-right': 'bottom-right corner',
  center: 'middle'
}

/** The reply when the message names an asset and the turn can place one; null when it is not about an asset. */
export async function fakePlaceAsset(
  input: ChatInput,
  sink: ChatSink,
  slideIds: readonly string[]
): Promise<string | null> {
  const name = input.assets ? assetTokenNames(input.text)[0] : undefined
  if (!input.assets || !name) return null
  const slideId = (input.selectedSlideJson as { id?: string } | undefined)?.id ?? slideIds[0]
  if (!slideId) return null
  const anchor = WORDS.find(([pattern]) => pattern.test(input.text))?.[1] ?? 'top-right'
  const args: PlaceToolArgs = {
    asset: name,
    slideId,
    anchor,
    boxX: 0,
    boxY: 0,
    boxW: 0,
    boxH: 0,
    region: 0,
    spot: '',
    widthUnits: 0,
    fit: 'fit',
    replaceUnder: false
  }
  sink.status('Placing the picture', 'running')
  const placed = await input.assets.place(args)
  sink.status('Placing the picture', placed.ok ? 'done' : 'error')
  if (!placed.ok) return placed.error
  sink.changes(placed.changeSet)
  const number = Math.max(1, slideIds.indexOf(slideId) + 1)
  return `Done! {{${name}}} is in the ${SAYS[anchor]} of slide ${number}.`
}
