import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { RENDER_CHANNELS } from '@main/render/ipc'
import { isRenderJob, type RenderBridge, type RenderJob } from '@shared/annotate/renderJob'

/**
 * Preload of the hidden render window only. The page can subscribe to jobs and report back; it gets no
 * other door to the main process. A message on the job channel that is not a well-formed job is dropped.
 */
const bridge: RenderBridge = {
  onJob: (listener) => {
    const handler = (_event: IpcRendererEvent, job: unknown): void => {
      if (isRenderJob(job)) listener(job as RenderJob)
    }
    ipcRenderer.on(RENDER_CHANNELS.job, handler)
    return () => ipcRenderer.removeListener(RENDER_CHANNELS.job, handler)
  },
  listening: () => ipcRenderer.send(RENDER_CHANNELS.listening),
  report: (report) => ipcRenderer.send(RENDER_CHANNELS.report, report)
}

contextBridge.exposeInMainWorld('slideRender', bridge)
