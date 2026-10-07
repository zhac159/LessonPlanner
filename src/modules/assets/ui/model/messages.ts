import type { AddedPictures, RejectedImage } from '@shared/contracts/assets'

/** What was wrong with a file, for one file and for several. */
const REASONS: Record<RejectedImage['reason'], { one: string; many: string }> = {
  type: {
    one: 'isn’t a picture, PDF or PowerPoint I can use',
    many: 'aren’t pictures, PDFs or PowerPoints I can use'
  },
  'too-large': { one: 'is too big', many: 'are too big' },
  corrupt: { one: 'couldn’t be read', many: 'couldn’t be read' },
  empty: { one: 'is empty', many: 'are empty' },
  limit: { one: 'went over the limit for one go', many: 'went over the limit for one go' }
}

/** One line per kind of refusal: "notes.docx isn’t a picture…", "2 files are too big.". */
export function rejectionMessages(rejected: readonly RejectedImage[]): string[] {
  const byReason = new Map<RejectedImage['reason'], RejectedImage[]>()
  for (const file of rejected)
    byReason.set(file.reason, [...(byReason.get(file.reason) ?? []), file])
  return [...byReason].map(([reason, files]) => {
    const first = files[0]!
    if (files.length > 1) return `${files.length} files ${REASONS[reason].many}.`
    return first.name ? `${first.name} ${REASONS[reason].one}.` : `A file ${REASONS[reason].one}.`
  })
}

/** What to tell her after Upload or a drop: "Cutting out your pictures…" or nothing when nothing was taken. */
export function addedMessage(added: AddedPictures): string | null {
  if (added.accepted === 0) return null
  return added.accepted === 1
    ? 'Looking at 1 file. Nothing is added until you say so.'
    : `Looking at ${added.accepted} files. Nothing is added until you say so.`
}

/** "{n} assets added to Your assets". */
export const addedToLibrary = (count: number): string =>
  `${count} ${count === 1 ? 'asset' : 'assets'} added to Your assets`

/** Shown when a screen cannot reach main at all (not a `Result` failure). */
export const COULDNT_LOAD = 'Couldn’t load your assets. Please try again.'
export const COULDNT_SAVE = 'Couldn’t save that. Check there’s space on this PC and try again.'
