/**
 * Plain-English messages for the things that can go wrong before the window opens, and the native dialog that
 * shows them. The teacher sees what happened and what to do; the technical text sits behind "Show details".
 * `describeProblem` and `dataFolderNotice` are pure and unit-tested; `showProblem` is the thin Electron part.
 */
import { dialog } from 'electron'
import { DataFolderError } from './services/paths'

export interface Problem {
  /** `error` ends the app; `warning` is a notice and the app goes on. */
  severity: 'error' | 'warning'
  title: string
  /** What happened and what to do, in plain words. */
  message: string
  /** Technical text, shown only when the teacher asks for it. */
  details: string
}

const technical = (error: unknown): string =>
  error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error)

/** The app cannot start: explains it. A data-folder problem gets its own wording. */
export function describeProblem(error: unknown): Problem {
  if (error instanceof DataFolderError) {
    return {
      severity: 'error',
      title: 'Slide Planner can’t start',
      message:
        `Slide Planner can’t save your lessons in ${error.folder}.\n\n` +
        (error.explicit
          ? 'That is the folder it was told to use, and it can’t be written to. Check that it exists and that you are allowed to change files in it.'
          : 'The folder is read-only, and so is the backup place in your user profile. Move Slide Planner to a folder you can change, such as Documents, or ask whoever looks after this computer to give you access.'),
      details: technical(error)
    }
  }
  return {
    severity: 'error',
    title: 'Slide Planner can’t start',
    message:
      'Something went wrong while Slide Planner was starting, so it has closed. Nothing you saved has been changed.\n\n' +
      'Please open it again. If this keeps happening, show the details to whoever looks after this app.',
    details: technical(error)
  }
}

/** The default folder was not writable and the per-user folder is used instead: tell the teacher once. */
export function dataFolderNotice(wanted: string, usedInstead: string, reason: string): Problem {
  return {
    severity: 'warning',
    title: 'Slide Planner is saving somewhere else',
    message:
      `Slide Planner can’t save your lessons in ${wanted}.\n\n` +
      `It will save them in ${usedInstead} instead. Your lessons are safe there, but they won’t be next to the app, ` +
      'so copy that folder if you move to another computer. Settings shows where your lessons are.',
    details: `${wanted}: ${reason}\nUsing: ${usedInstead}`
  }
}

/** Shows the problem in a native dialog with a "Show details" button, and resolves when it is dismissed. */
export async function showProblem(problem: Problem): Promise<void> {
  const base = {
    type: problem.severity,
    title: problem.title,
    message: problem.message,
    noLink: true,
    defaultId: 0
  } as const
  const dismiss = problem.severity === 'error' ? 'Close' : 'OK'
  const first = await dialog.showMessageBox({ ...base, buttons: [dismiss, 'Show details'] })
  if (first.response !== 1) return
  await dialog.showMessageBox({
    type: 'info',
    title: problem.title,
    message: 'Details for whoever looks after this app',
    detail: problem.details,
    buttons: ['Close'],
    noLink: true
  })
}
