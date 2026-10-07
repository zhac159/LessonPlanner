/** Copy for the callouts and toasts of the Create a style screen (04 §5 "State copy"). Pure. */
import { aiErrorMessage } from '@shared/ai/errors'
import type { RejectedFile } from '@shared/contracts/style-library'
import type { AiErrorCode } from '@shared/result'
import { MAX_FILES_PER_STYLE } from '../../shared'

/** What the paused-queue callout offers besides "Carry on". */
export type PauseAction = 'connect' | 'settings' | 'console' | 'none'

export interface PauseCopy {
  message: string
  action: PauseAction
}

/** The README AI-error copy for an account problem or network pause, with its action. */
export function describePause(code: AiErrorCode | undefined): PauseCopy {
  const message = aiErrorMessage(code ?? 'unknown')
  switch (code) {
    case 'no-key':
      return { message, action: 'connect' }
    case 'invalid-key':
    case 'permission':
    case 'model-unavailable':
      return { message, action: 'settings' }
    case 'no-credit':
      return { message, action: 'console' }
    default:
      return { message, action: 'none' }
  }
}

export const NAMES_WARNING =
  'Some slides may contain pupil names. They’ll be sent to Claude to learn your style. Remove the file if you’d rather not.'

export const PRIVACY_NOTE =
  'Each file is sent to Claude to learn your style. A copy is kept on this computer.'

export const ALL_FAILED =
  'I couldn’t read any of these files. Try PowerPoint files or PDFs exported from PowerPoint.'

const count = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** One toast sentence per kind of rejection, in a stable order. */
export function rejectionMessages(rejected: readonly RejectedFile[]): string[] {
  const of = (reason: RejectedFile['reason']): RejectedFile[] =>
    rejected.filter((file) => file.reason === reason)
  const messages: string[] = []

  const wrongType = [...of('type'), ...of('old-ppt')]
  if (wrongType.length > 0) {
    messages.push(
      `Skipped ${wrongType.length} ${count(wrongType.length, 'file that isn’t', 'files that aren’t')} PDF or PowerPoint.`
    )
  }
  const tooLarge = of('too-large')
  if (tooLarge.length > 0) {
    messages.push(
      `Skipped ${tooLarge.length} ${count(tooLarge.length, 'file', 'files')} over 50 MB.`
    )
  }
  const duplicates = of('duplicate')
  if (duplicates.length === 1) messages.push(`${duplicates[0].name} is already in this style.`)
  else if (duplicates.length > 1) {
    messages.push(`${duplicates.length} of those files are already in this style.`)
  }
  const overLimit = of('limit')
  if (overLimit.length > 0) {
    messages.push(`Only ${MAX_FILES_PER_STYLE} files per style. I skipped ${overLimit.length}.`)
  }
  return messages
}

/** "Saved “Science KS3”" with the number of files that are still being read, if any. */
export function savedMessage(name: string, stillLearning: number): string {
  return stillLearning > 0
    ? `Saved “${name}”. I’ll keep learning from the other ${stillLearning} ${count(stillLearning, 'file', 'files')}.`
    : `Saved “${name}”`
}
