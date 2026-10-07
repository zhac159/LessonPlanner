/**
 * Electron adapters for the deck-builder ports: native Save/Open dialogs, the Recycle Bin, "open" and
 * "show in folder", full screen. Each factory takes the Electron object it needs, so tests can pass a fake
 * and the composition itself never imports `electron`.
 *
 * Test hook: when `SLIDE_PLANNER_TEST=1` the dialogs do not open and answer with
 * `SLIDE_PLANNER_TEST_SAVE_PATH` / `SLIDE_PLANNER_TEST_OPEN_PATH` instead (unset = the teacher cancelled),
 * so automated runs can export and attach files without a person clicking.
 */
import type { BrowserWindow, Dialog } from 'electron'
import type { DialogPort, TrashPort } from '../lessons/types'
import type { FullScreenPort, OpenerPort } from './ports'

export const TEST_MODE_ENV = 'SLIDE_PLANNER_TEST'
export const TEST_SAVE_PATH_ENV = 'SLIDE_PLANNER_TEST_SAVE_PATH'
export const TEST_OPEN_PATH_ENV = 'SLIDE_PLANNER_TEST_OPEN_PATH'

type Env = Readonly<Record<string, string | undefined>>

/** The answer automated runs give a dialog (`undefined` = cancelled), or `null` when not in test mode. */
export function testAnswer(env: Env, variable: string): string | undefined | null {
  if (env[TEST_MODE_ENV] !== '1') return null
  return env[variable]?.trim() || undefined
}

/** The part of Electron's `dialog` that the adapter uses. */
export interface DialogLike {
  showSaveDialog(
    window: BrowserWindow | null,
    options: {
      title: string
      defaultPath: string
      filters: Array<{ name: string; extensions: string[] }>
    }
  ): Promise<{ canceled: boolean; filePath?: string }>
  showOpenDialog(
    window: BrowserWindow | null,
    options: {
      title: string
      properties: Array<'openFile'>
      filters: Array<{ name: string; extensions: string[] }>
    }
  ): Promise<{ canceled: boolean; filePaths: string[] }>
}

export interface DialogPortDeps {
  dialog: DialogLike
  /** The window the dialogs belong to (modal over it), or null. */
  window(): BrowserWindow | null
  /** Where Save starts: the teacher's Documents folder. */
  documentsDir(): string
  env?: Env
}

/** Electron's `dialog`, narrowed to what the adapter calls (with or without a parent window). */
export function fromElectronDialog(dialog: Dialog): DialogLike {
  return {
    showSaveDialog: (window, options) =>
      window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options),
    showOpenDialog: (window, options) =>
      window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
  }
}

/** Save and Open dialogs for exporting, LO documents and attachments (06 §8.11, 05 §8). */
export function createDialogPort(deps: DialogPortDeps): DialogPort {
  const env = deps.env ?? process.env
  const parent = (): BrowserWindow | null => deps.window()
  return {
    async pickSavePath(defaultName) {
      const forced = testAnswer(env, TEST_SAVE_PATH_ENV)
      if (forced !== null) return forced
      const result = await deps.dialog.showSaveDialog(parent(), {
        title: 'Export to PowerPoint',
        defaultPath: `${deps.documentsDir()}\\${defaultName}`,
        filters: [{ name: 'PowerPoint presentation', extensions: ['pptx'] }]
      })
      return result.canceled ? undefined : result.filePath
    },
    async pickOpenPath({ title, extensions }) {
      const forced = testAnswer(env, TEST_OPEN_PATH_ENV)
      if (forced !== null) return forced
      const result = await deps.dialog.showOpenDialog(parent(), {
        title,
        properties: ['openFile'],
        filters: [{ name: 'Files', extensions }]
      })
      return result.canceled ? undefined : result.filePaths[0]
    }
  }
}

/** Moves a lesson folder to the Recycle Bin (Electron `shell.trashItem`). */
export function createTrashPort(shell: { trashItem(path: string): Promise<void> }): TrashPort {
  return { trashItem: (path) => shell.trashItem(path) }
}

/** `shell.openPath` and `showItemInFolder` for the export toast and AttachmentCards. */
export function createOpenerPort(shell: OpenerPort): OpenerPort {
  return {
    openPath: (path) => shell.openPath(path),
    showItemInFolder: (path) => shell.showItemInFolder(path)
  }
}

/** Full screen for Present, on whichever window is the app's main window. */
export function createFullScreenPort(
  getWindow: () => { setFullScreen(on: boolean): void } | null
): FullScreenPort {
  return { setFullScreen: (on) => getWindow()?.setFullScreen(on) }
}
