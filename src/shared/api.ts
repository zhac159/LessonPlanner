/**
 * The contract of `window.api`, the only bridge between the sandboxed renderer and the
 * main process. Implemented in src/preload/index.ts, consumed in src/renderer.
 * Pure types only: no Node, Electron or DOM imports.
 */

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  isPackaged: boolean
  /** The folder every lesson and setting is saved in (the data root). */
  dataRoot?: string
  /** Set when `dataRoot` is the per-user fallback because this folder (next to the app) could not be written to. */
  dataRootFallbackFrom?: string
}

/** What the main process returns for every module invoke; the preload unwraps it. */
export type InvokeResult<T = unknown> = { ok: true; value: T } | { ok: false; error: string }

/** A push message from a main-process module to the renderer. */
export interface ModuleEventMessage {
  moduleId: string
  channel: string
  payload: unknown
}

export interface PlanningApi {
  /** `process.platform` of the host, e.g. 'win32'. */
  platform: string
  /** True when the app was started with SLIDE_PLANNER_TEST=1 (e2e and visual scripts). */
  testMode: boolean
  files: {
    /** The real path of a dropped or picked `File`. The renderer is sandboxed and cannot read it itself. */
    pathFor(file: File): string
  }
  app: {
    getInfo(): Promise<AppInfo>
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    close(): void
    isMaximized(): Promise<boolean>
    /** Enter or leave full screen (Present mode). */
    setFullScreen(on: boolean): void
    /** Returns an unsubscribe function. */
    onMaximizedChange(listener: (maximized: boolean) => void): () => void
  }
  modules: {
    /** Call a handler registered by a main-process module. Rejects with the handler's error message. */
    invoke<T = unknown>(moduleId: string, channel: string, ...args: unknown[]): Promise<T>
    /** Listen to events a main-process module emits. Returns an unsubscribe function. */
    on(moduleId: string, channel: string, listener: (payload: unknown) => void): () => void
  }
}
