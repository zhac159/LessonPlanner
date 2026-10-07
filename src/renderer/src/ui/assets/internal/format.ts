/** Wording helpers shared by the assets kit (exact copy from agents/ASSETS.md §3). */
import type { AssetFoundIn, AssetSourceKind } from '@shared/assets/types'
import type { LeftOutReason } from '@shared/contracts/assets'

/** "14 lessons" lives in `lessonCountLabel` (@shared/assets/library); the reasons and sources are here. */
export function leftOutLabel(reason: LeftOutReason, ofName?: string): string {
  switch (reason) {
    case 'pupils':
      return 'May show pupils · left out'
    case 'blurry':
      return 'Blurry · left out'
    case 'older-version':
      return ofName ? `Older version of ${ofName}` : 'Older version · left out'
    case 'low-resolution':
      return 'Small picture · left out'
    case 'background':
      return 'Looks like a slide background · left out'
    case 'unreadable':
      return "Can't read this picture · left out"
    case 'duplicate':
      return 'Already in Your assets'
  }
}

/** "In 24 decks" (A2), "In 1 deck". */
export const decksLabel = (decks: number): string => `In ${decks} ${decks === 1 ? 'deck' : 'decks'}`

/** "4 found". */
export const foundCountLabel = (count: number): string => `${count} found`

const SOURCE_LINES: Record<Exclude<AssetSourceKind, 'extracted'>, string> = {
  uploaded: 'Added by you',
  online: 'Picked online',
  generated: 'Made with Claude'
}

/**
 * The "Found in" line of the detail pane: "Found in Y8 Photosynthesis.pptx, slide 1 and 23 other decks",
 * or "Added by you" / "Picked online" / "Made with Claude" when it was not found in a deck.
 */
export function foundInText(foundIn: readonly AssetFoundIn[], sourceKind: AssetSourceKind): string {
  const first = foundIn[0]
  if (!first) return sourceKind === 'extracted' ? 'Found in your decks' : SOURCE_LINES[sourceKind]
  const where = first.page ? `${first.fileName}, slide ${first.page}` : first.fileName
  const others = foundIn.length - 1
  if (others <= 0) return `Found in ${where}`
  return `Found in ${where} and ${others} other ${others === 1 ? 'deck' : 'decks'}`
}

/** "About 54 cents · Google bills this" (a picture maker) from the per-picture price and the versions. */
export function costLine(perPictureUsd: number, versions: number): string {
  const total = perPictureUsd * versions
  const amount = total >= 1 ? `$${total.toFixed(2)}` : `${Math.round(total * 100)} cents`
  return `About ${amount} · Google bills this`
}

/** Cut at `max` characters with an ellipsis: "Photo: leaf in sunlight" stays, longer text ends in "…". */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** "Replace what’s underneath (Photo: leaf in sunlight)"; no brackets when there is no description. */
export function replaceLabel(underneath?: string): string {
  return underneath
    ? `Replace what’s underneath (${truncate(underneath, 28)})`
    : 'Replace what’s underneath'
}

/** "3 picture spots to fill" and its singular. */
export const spotsLabel = (count: number): string =>
  `${count} picture ${count === 1 ? 'spot' : 'spots'} to fill`

/** The A2 primary button: "Keep 9 assets", "Keep 1 asset", "Nothing to keep". */
export const keepLabel = (count: number): string =>
  count <= 0 ? 'Nothing to keep' : `Keep ${count} ${count === 1 ? 'asset' : 'assets'}`

/** "Found 12 · keeping 9". */
export const foundSummary = (found: number, keeping: number): string =>
  `Found ${found} · keeping ${keeping}`
