import { app, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppInfo, InvokeResult } from '@shared/api'
import { invokeHandler } from './moduleBus'
import { dataRootFallbackFrom, dataRootIfSet } from './services/paths'
import { getMainWindow, isAppUrl } from './window'

/** Only the app's own page, in our own window's top frame, may talk to the main process. */
function isTrusted(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const win = getMainWindow()
  if (!win || event.sender !== win.webContents) return false
  const frame = event.senderFrame
  return frame !== null && frame === win.webContents.mainFrame && isAppUrl(frame.url)
}

export function registerCoreIpc(): void {
  ipcMain.handle(IPC.app.info, (event): AppInfo => {
    if (!isTrusted(event)) throw new Error('Untrusted IPC sender')
    return {
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      isPackaged: app.isPackaged,
      dataRoot: dataRootIfSet(),
      dataRootFallbackFrom: dataRootFallbackFrom()
    }
  })

  ipcMain.on(IPC.window.minimize, (event) => {
    if (isTrusted(event)) getMainWindow()?.minimize()
  })

  ipcMain.on(IPC.window.toggleMaximize, (event) => {
    if (!isTrusted(event)) return
    const win = getMainWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on(IPC.window.close, (event) => {
    if (isTrusted(event)) getMainWindow()?.close()
  })

  ipcMain.on(IPC.window.setFullScreen, (event, on: unknown) => {
    if (isTrusted(event) && typeof on === 'boolean') getMainWindow()?.setFullScreen(on)
  })

  ipcMain.handle(IPC.window.isMaximized, (event) => {
    if (!isTrusted(event)) return false
    return getMainWindow()?.isMaximized() ?? false
  })

  ipcMain.handle(
    IPC.modules.invoke,
    async (
      event,
      moduleId: unknown,
      channel: unknown,
      ...args: unknown[]
    ): Promise<InvokeResult> => {
      if (!isTrusted(event)) return { ok: false, error: 'Untrusted IPC sender' }
      if (typeof moduleId !== 'string' || typeof channel !== 'string') {
        return { ok: false, error: 'moduleId and channel must be strings' }
      }
      return invokeHandler(moduleId, channel, args)
    }
  )
}
