import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { TEST_MODE_ARG } from '@shared/appConfig'
import { IPC } from '@shared/ipc'
import type { InvokeResult, ModuleEventMessage, PlanningApi } from '@shared/api'

/** Module event listeners, keyed `moduleId:channel` (ids never contain a colon), served by ONE ipcRenderer listener. */
const eventListeners = new Map<string, Set<(payload: unknown) => void>>()
const listenerKey = (moduleId: string, channel: string): string => `${moduleId}:${channel}`
let eventsHooked = false

function hookModuleEvents(): void {
  if (eventsHooked) return
  eventsHooked = true
  ipcRenderer.on(IPC.modules.event, (_event: IpcRendererEvent, message: ModuleEventMessage) => {
    eventListeners
      .get(listenerKey(message.moduleId, message.channel))
      ?.forEach((listener) => listener(message.payload))
  })
}

/**
 * The renderer's only door to the main process. Keep this file tiny and generic: feature
 * modules talk through `modules.invoke` / `modules.on`, they never add methods here.
 */
const api: PlanningApi = {
  platform: process.platform,
  testMode: process.argv.includes(TEST_MODE_ARG),

  files: {
    pathFor: (file) => webUtils.getPathForFile(file)
  },

  app: {
    getInfo: () => ipcRenderer.invoke(IPC.app.info)
  },

  window: {
    minimize: () => ipcRenderer.send(IPC.window.minimize),
    toggleMaximize: () => ipcRenderer.send(IPC.window.toggleMaximize),
    close: () => ipcRenderer.send(IPC.window.close),
    isMaximized: () => ipcRenderer.invoke(IPC.window.isMaximized),
    setFullScreen: (on) => ipcRenderer.send(IPC.window.setFullScreen, on),
    onMaximizedChange: (listener) => {
      const handler = (_event: IpcRendererEvent, maximized: boolean): void => listener(maximized)
      ipcRenderer.on(IPC.window.maximizedChanged, handler)
      return () => ipcRenderer.removeListener(IPC.window.maximizedChanged, handler)
    }
  },

  modules: {
    async invoke<T = unknown>(moduleId: string, channel: string, ...args: unknown[]): Promise<T> {
      const result = (await ipcRenderer.invoke(
        IPC.modules.invoke,
        moduleId,
        channel,
        ...args
      )) as InvokeResult<T>
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    on: (moduleId, channel, listener) => {
      hookModuleEvents()
      const key = listenerKey(moduleId, channel)
      const set = eventListeners.get(key) ?? new Set()
      eventListeners.set(key, set)
      set.add(listener)
      return () => {
        set.delete(listener)
        if (set.size === 0) eventListeners.delete(key)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
