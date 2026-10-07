/** The Electron half of the "add files" dialog: the only place in this module that imports `electron`. */
import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron'
import type { StyleDialogPort } from './api'

/** The native picker: "Slides (*.pdf, *.pptx)", several files at once. */
export function createElectronStyleDialog(): StyleDialogPort {
  return {
    async pickFiles() {
      const options: OpenDialogOptions = {
        title: 'Add PDFs or PowerPoints',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Slides (*.pdf, *.pptx)', extensions: ['pdf', 'pptx'] }]
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? undefined : result.filePaths
    }
  }
}
