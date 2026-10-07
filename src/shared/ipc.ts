/**
 * Every IPC channel name used by the core app. The list is deliberately short:
 * feature modules never add channels here, they go through the generic
 * `modules:invoke` / `modules:event` pair (see agents/ARCHITECTURE.md).
 */
export const IPC = {
  app: {
    info: 'app:info'
  },
  window: {
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    isMaximized: 'window:is-maximized',
    maximizedChanged: 'window:maximized-changed',
    /** renderer -> main: (on: boolean) toggles full screen (Present mode). */
    setFullScreen: 'window:set-fullscreen'
  },
  modules: {
    /** renderer -> main request/response: (moduleId, channel, ...args) => InvokeResult */
    invoke: 'modules:invoke',
    /** main -> renderer push: ModuleEventMessage */
    event: 'modules:event'
  }
} as const
