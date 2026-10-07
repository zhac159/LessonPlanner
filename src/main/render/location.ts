/** Where the render page lives and which URLs it may touch (pure, so it is unit-tested). */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RENDER_PAGE = 'render.html'

export interface RenderPageOptions {
  /** `ELECTRON_RENDERER_URL` of `electron-vite dev`; undefined for built and packaged apps. */
  devServerUrl?: string
  /** Folder holding the built renderer (`out/renderer`). */
  rendererDir: string
}

/** The page as a URL: the dev server's `render.html`, or the built file. */
export function renderPageUrl({ devServerUrl, rendererDir }: RenderPageOptions): string {
  if (devServerUrl) return new URL(RENDER_PAGE, devServerUrl.replace(/\/?$/, '/')).href
  return pathToFileURL(join(rendererDir, RENDER_PAGE)).href
}

/**
 * The render window loads its own page and `data:`/`blob:` pictures, nothing else: no network, no other
 * files. Requests are refused unless this says yes.
 */
export function isAllowedRenderUrl(url: string, pageUrl: string): boolean {
  let target: URL
  let page: URL
  try {
    target = new URL(url)
    page = new URL(pageUrl)
  } catch {
    return false
  }
  if (target.protocol === 'data:' || target.protocol === 'blob:') return true
  if (page.protocol === 'file:') {
    const folder = page.pathname.slice(0, page.pathname.lastIndexOf('/') + 1)
    return target.protocol === 'file:' && target.pathname.startsWith(folder)
  }
  return target.origin === page.origin
}
