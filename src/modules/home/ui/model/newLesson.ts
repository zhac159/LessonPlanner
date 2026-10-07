import type { RejectedFile } from '@shared/contracts/style-library'

/** Lesson lengths offered by the length chip, in minutes (03 §5). */
export const LENGTHS = [30, 40, 45, 50, 60, 75, 90] as const
export const DEFAULT_LENGTH_MIN = 50

/** The length to start with: the last one used when it is still on offer, else 50. */
export function initialLength(last: number | null | undefined): number {
  return last != null && (LENGTHS as readonly number[]).includes(last) ? last : DEFAULT_LENGTH_MIN
}

/** Create lesson is enabled with non-space text or an attached document (03 §8). */
export function canCreate(text: string, hasDocument: boolean): boolean {
  return text.trim().length > 0 || hasDocument
}

/** Extensions the Make a new lesson card accepts for an objectives document. */
export const LO_EXTENSIONS = ['.docx', '.pdf', '.pptx'] as const
/** Extensions the Your styles Dropzone accepts. */
export const STYLE_EXTENSIONS = ['.pdf', '.pptx'] as const
export const MAX_STYLE_FILES = 50

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}

/** Why a dropped file cannot start a style, before main sees it: `.ppt` is too old, others the wrong type. */
export function rejectOnClient(files: ReadonlyArray<{ name: string }>): RejectedFile[] {
  return files.map((file) => ({
    name: file.name,
    reason: extensionOf(file.name) === '.ppt' ? 'old-ppt' : 'type'
  }))
}

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

/** One toast sentence for every rejected file (03 §5 "Rejected files toast"); empty when none. */
export function rejectedMessage(rejected: ReadonlyArray<RejectedFile>): string {
  const lines: string[] = []
  const wrongType = rejected.filter((file) => file.reason === 'type')
  if (wrongType.length > 0) {
    const noun = wrongType.length === 1 ? 'file that isn’t' : 'files that aren’t'
    lines.push(`Skipped ${wrongType.length} ${noun} PDF or PowerPoint.`)
  }
  if (rejected.some((file) => file.reason === 'limit')) {
    lines.push(`Only the first ${MAX_STYLE_FILES} files were added.`)
  }
  for (const file of rejected.filter((item) => item.reason === 'too-large')) {
    lines.push(`${file.name} is over 50 MB, so I skipped it.`)
  }
  if (rejected.some((file) => file.reason === 'old-ppt')) {
    lines.push('.ppt files are too old to read. Save them as .pptx first.')
  }
  const duplicates = rejected.filter((file) => file.reason === 'duplicate')
  if (duplicates.length > 0) {
    lines.push(
      `Skipped ${count(duplicates.length, 'file')} that ${duplicates.length === 1 ? 'was' : 'were'} already added.`
    )
  }
  return lines.join(' ')
}
