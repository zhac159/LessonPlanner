/**
 * The channels between main and the offscreen render window. Dedicated and tiny: the render page never
 * uses the app's module bus, and the app's windows never use these.
 */
export const RENDER_CHANNELS = {
  /** main -> page: a `RenderJob`. */
  job: 'slide-render:job',
  /** page -> main: the page has subscribed and can take jobs. */
  listening: 'slide-render:listening',
  /** page -> main: a `RenderReport` (the job is drawn, or failed). */
  report: 'slide-render:report'
} as const
