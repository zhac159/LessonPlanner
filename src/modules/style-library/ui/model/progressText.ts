/** The words and numbers of the progress block and the header pill (04 §5, §7). Pure. */
import type { LearnProgress } from '@shared/contracts/style-library'

type StatusTone = 'done' | 'working' | 'waiting'

/** Files neither learned nor failed yet. */
export const pendingFiles = (progress: LearnProgress): number =>
  Math.max(progress.total - progress.learned - progress.failed, 0)

/** "About a minute left" and friends; "Putting it all together…" while synthesising; nothing otherwise. */
export function describeEta(progress: LearnProgress): string | undefined {
  if (progress.stage === 'synthesising') return 'Putting it all together…'
  if (progress.stage === 'pictures') return 'Looking at your pictures…'
  if (progress.stage === 'done' || progress.stage === 'paused') return undefined
  const seconds = progress.etaSeconds
  if (seconds === null || pendingFiles(progress) === 0) return undefined
  if (seconds < 45) return 'Less than a minute left'
  if (seconds < 90) return 'About a minute left'
  return `About ${Math.round(seconds / 60)} minutes left`
}

export interface HeaderPill {
  text: string
  tone: StatusTone
  check: boolean
}

const files = (n: number): string => `${n} ${n === 1 ? 'file' : 'files'}`

/** The StatusPill beside "Save style"; null when there are no files, or when none could be read. */
export function describeHeaderPill(progress: LearnProgress): HeaderPill | null {
  if (progress.total === 0) return null
  if (progress.stage === 'paused') return { text: 'Paused', tone: 'waiting', check: false }
  if (progress.stage === 'synthesising' || progress.stage === 'pictures') {
    return { text: 'Finishing up…', tone: 'working', check: false }
  }
  if (pendingFiles(progress) === 0 && progress.stage !== 'reading') {
    if (progress.learned === 0) return null
    return { text: `Learned from ${files(progress.learned)}`, tone: 'done', check: true }
  }
  return {
    text: `Learning · ${progress.learned} of ${files(progress.total)}`,
    tone: 'working',
    check: false
  }
}

/** "2 files couldn’t be read" under the progress bar, or undefined when all were read. */
export function describeFailures(progress: LearnProgress): string | undefined {
  if (progress.failed === 0 || pendingFiles(progress) > 0) return undefined
  return progress.failed === 1
    ? '1 file couldn’t be read'
    : `${progress.failed} files couldn’t be read`
}

/** Every file failed: the panel stays empty and a callout explains. */
export const allFailed = (progress: LearnProgress): boolean =>
  progress.total > 0 && progress.learned === 0 && progress.failed === progress.total
