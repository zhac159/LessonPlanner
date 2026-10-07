/**
 * Automation switches: what makes a run "automated" (hidden window, second monitor, test hooks).
 *
 * Automated runs (Playwright, e2e, screenshots, agents) must not pop up over the owner's work, but the owner must
 * NEVER end up with an invisible app because of a stray environment variable (SLIDE_PLANNER_TEST left in a user
 * profile, CLAUDECODE inherited from a terminal). So in a packaged build the switches are ignored unless the launch
 * carries the explicit unlock argument `--slide-planner-automation`, which only the packaged e2e flow passes.
 * Development builds (`electron .`) keep honouring the environment.
 *
 * Pure (no `electron` import): `window.ts` feeds it `process.env`, `process.argv` and `app.isPackaged`.
 */

/** The explicit unlock for packaged builds; also marks a second launch as "not the owner" (see `isAutomatedLaunch`). */
export const AUTOMATION_ARG = '--slide-planner-automation'

export interface AutomationInput {
  env: Readonly<Record<string, string | undefined>>
  argv: readonly string[]
  isPackaged: boolean
}

export interface Automation {
  /** SLIDE_PLANNER_TEST=1 honoured: test hooks (`api.testMode`, `window.__shell`) are on. */
  testMode: boolean
  /** Started by a script or an agent: the window opens on a secondary monitor and never steals focus. */
  automated: boolean
  /** The main window is never shown (SLIDE_PLANNER_HEADLESS=1, or automated unless HEADLESS=0). */
  hidden: boolean
  /** SLIDE_PLANNER_DISPLAY=<n>, a monitor override for automated runs (left-to-right index). */
  displayEnv: string | undefined
}

/** True when the launch itself says a script started it (the unlock, or a remote-debugging switch from Playwright). */
export function isAutomatedLaunch(argv: readonly string[]): boolean {
  return argv.some(
    (arg) =>
      arg === AUTOMATION_ARG ||
      arg === '--remote-debugging-pipe' ||
      arg.startsWith('--remote-debugging-port')
  )
}

export function resolveAutomation({ env, argv, isPackaged }: AutomationInput): Automation {
  const off: Automation = {
    testMode: false,
    automated: false,
    hidden: false,
    displayEnv: undefined
  }
  if (isPackaged && !argv.includes(AUTOMATION_ARG)) return off
  const testMode = env.SLIDE_PLANNER_TEST === '1'
  const automated = testMode || env.CLAUDECODE === '1' || argv.includes('--remote-debugging-pipe')
  const hidden =
    env.SLIDE_PLANNER_HEADLESS === '1' || (automated && env.SLIDE_PLANNER_HEADLESS !== '0')
  return { testMode, automated, hidden, displayEnv: env.SLIDE_PLANNER_DISPLAY }
}
