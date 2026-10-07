/**
 * The app's one SlideRenderer (created lazily, closed when the app quits). Services receive it through
 * `createSlideRendererPort(getSlideRenderer())`; nothing else needs to know about the hidden window.
 */
import { app } from 'electron'
import { join } from 'node:path'
import { createElectronSurface } from './electronSurface'
import { renderPageUrl } from './location'
import { SlideRenderer } from './SlideRenderer'

export { createSlideRendererPort } from './port'
export { RenderError, SlideRenderer, type RenderErrorCode } from './SlideRenderer'
export type {
  RenderCropOptions,
  RenderSlideOptions,
  RenderThumbnailOptions,
  RenderViewOptions,
  ViewRenderer
} from './port'

export interface CreateSlideRendererOptions {
  /** Folder of the built renderer; default `out/renderer` next to the built main process. */
  rendererDir?: string
  /** Built render preload; default `out/preload/render.js`. */
  preloadPath?: string
  /** Dev server URL; default `ELECTRON_RENDERER_URL` while not packaged. */
  devServerUrl?: string
  timeoutMs?: number
}

/** A SlideRenderer drawing in a hidden Electron window (not shared: prefer `getSlideRenderer`). */
export function createSlideRenderer(options: CreateSlideRendererOptions = {}): SlideRenderer {
  const pageUrl = renderPageUrl({
    devServerUrl:
      options.devServerUrl ?? (app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']),
    rendererDir: options.rendererDir ?? join(__dirname, '../renderer')
  })
  const preloadPath = options.preloadPath ?? join(__dirname, '../preload/render.js')
  return new SlideRenderer({
    timeoutMs: options.timeoutMs,
    createSurface: () => createElectronSurface({ pageUrl, preloadPath })
  })
}

let shared: SlideRenderer | null = null

/** The shared renderer; its window opens on the first job and closes when the app quits. */
export function getSlideRenderer(): SlideRenderer {
  if (!shared) {
    shared = createSlideRenderer()
    app.once('will-quit', () => shared?.dispose())
  }
  return shared
}

/**
 * Destroys the hidden render window now (and fails its pending renders). The app calls this when the main window
 * closes: a hidden window that is still alive keeps Electron from ever firing `window-all-closed`, which left an
 * invisible process behind. Safe when nothing was ever rendered and safe to call twice; later renders are refused.
 */
export function disposeSlideRenderer(): void {
  shared?.dispose()
}
