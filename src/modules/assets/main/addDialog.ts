/** The Electron half of "Add files": the native picker for pictures, PDFs and PowerPoints. */
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import { PICTURE_EXTENSIONS } from '../shared'
import type { AddPickerPort } from './review'

export function createElectronAddPicker(): AddPickerPort {
  return {
    async pickPaths() {
      const options: OpenDialogOptions = {
        title: 'Add pictures to Your assets',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Pictures, PDFs and PowerPoints',
            extensions: [...PICTURE_EXTENSIONS, 'pdf', 'pptx', 'ppt']
          },
          { name: 'Pictures', extensions: [...PICTURE_EXTENSIONS] },
          { name: 'PDFs and PowerPoints', extensions: ['pdf', 'pptx', 'ppt'] }
        ]
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? undefined : result.filePaths
    }
  }
}
