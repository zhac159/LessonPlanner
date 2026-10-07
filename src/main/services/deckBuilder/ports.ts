/**
 * Ports the deck-builder wiring needs from the operating system beyond the ones the lessons services
 * define (`DialogPort`, `TrashPort`, `SlideRendererPort`). Electron implements them in `electronPorts.ts`;
 * tests pass fakes, so nothing in the composition imports `electron`.
 */

/** Opens exported files and reveals them in Explorer (Electron `shell.openPath` / `showItemInFolder`). */
export interface OpenerPort {
  /** Opens a file with its default app. Resolves to an empty string on success, else the reason (Electron's convention). */
  openPath(path: string): Promise<string>
  /** Shows the file selected in its folder. */
  showItemInFolder(path: string): void
}

/** Switches the app window to full screen for Present mode. */
export interface FullScreenPort {
  setFullScreen(on: boolean): void
}
