/**
 * App-wide constants shared by the main process and the renderer.
 * Pure data only: no Node, Electron or DOM imports.
 */
export const APP_CONFIG = {
  appName: 'Slide Planner',
  /** Windows App User Model ID (taskbar grouping, notifications). */
  appId: 'com.slideplanner.desktop',
  /** Name shown on the welcome splash. A settings module may override this later. */
  userName: 'Alice',
  /** Window background before the page paints (avoids a white flash). Keep equal to --ground in design/tokens.css. */
  windowBackground: '#f1eeff'
} as const

/** Command-line flag main passes to the preload when `SLIDE_PLANNER_TEST=1` (becomes `api.testMode`). */
export const TEST_MODE_ARG = '--slide-planner-test'
