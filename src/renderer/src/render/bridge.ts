import type { RenderBridge } from '@shared/annotate/renderJob'

declare global {
  interface Window {
    /** Set by src/preload/render.ts in the hidden render window only. */
    slideRender?: RenderBridge
  }
}

/** The preload bridge of the render window; throws when the page is opened anywhere else. */
export function getRenderBridge(): RenderBridge {
  if (!window.slideRender)
    throw new Error('The render bridge is missing: open this page in the render window')
  return window.slideRender
}
