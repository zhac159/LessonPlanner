/** The Electron half of "Replace file": the only place in this module's main that imports `electron`. */
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { AssetError, MAX_ASSET_BYTES } from '@main/services/assets/store'
import { PICTURE_EXTENSIONS } from '../shared'
import type { ReplaceDialogPort } from './api'

/** The native picker for one picture; reads the chosen file (refusing anything over the 50 MB limit). */
export function createElectronReplaceDialog(): ReplaceDialogPort {
  return {
    async pickPicture() {
      const options: OpenDialogOptions = {
        title: 'Choose the new picture',
        properties: ['openFile'],
        filters: [{ name: 'Pictures', extensions: [...PICTURE_EXTENSIONS] }]
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      const path = result.canceled ? undefined : result.filePaths[0]
      if (!path) return undefined
      if ((await stat(path)).size > MAX_ASSET_BYTES) {
        throw new AssetError('too-large', 'That picture is too big.')
      }
      return { bytes: new Uint8Array(await readFile(path)), name: basename(path) }
    }
  }
}
