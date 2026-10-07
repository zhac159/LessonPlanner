/** `@ui/slide`: the one slide renderer plus its font and fit helpers. */
export { SlideView, type SlideViewProps } from './SlideView'
export { slideFonts } from './bundledFonts'
export { createFontLoader, type FontLoader, type FontRegistry } from './fonts'
export { domFitMeasurer, findFitFactor, FIT_STEP, MIN_FIT, type FitMeasurer } from './fit'
export type { SpotMode } from './context'
