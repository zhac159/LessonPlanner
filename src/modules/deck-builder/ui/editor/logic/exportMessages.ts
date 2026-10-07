/** The words of the Export to PowerPoint toasts (06 §5, §8.11). Pure. */
import type { ExportResult } from '@shared/contracts/deck-builder'

/** What to tell the teacher after an export attempt. `null` = nothing (she cancelled the dialog). */
export type ExportOutcome =
  { kind: 'saved'; message: string; path: string } | { kind: 'error'; message: string }

const joinNames = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** "Calibri isn’t installed on this PC, so PowerPoint will swap it." (several fonts: "…aren’t… swap them."). */
export function missingFontsLine(fonts: readonly string[]): string {
  if (fonts.length === 0) return ''
  const many = fonts.length > 1
  return `${joinNames(fonts)} ${many ? 'aren’t' : 'isn’t'} installed on this PC, so PowerPoint will swap ${many ? 'them' : 'it'}.`
}

export function exportOutcome(result: ExportResult): ExportOutcome | null {
  if (result.status === 'cancelled' || result.status === 'spots') return null
  if (result.status === 'saved') {
    const fonts = missingFontsLine(result.missingFonts)
    return {
      kind: 'saved',
      path: result.path,
      message: fonts ? `Saved ${result.fileName}. ${fonts}` : `Saved ${result.fileName}`
    }
  }
  return {
    kind: 'error',
    message:
      result.code === 'file-locked'
        ? result.message || 'Close the file in PowerPoint, then try again.'
        : 'Couldn’t save the file. Try another folder.'
  }
}
