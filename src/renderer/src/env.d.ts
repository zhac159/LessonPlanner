/// <reference types="vite/client" />

import type { PlanningApi } from '@shared/api'
import type { ShellTestHook } from './core/useShellTestHook'

declare global {
  interface Window {
    /** The preload bridge. See src/shared/api.ts. */
    api: PlanningApi
    /** Present only when the app runs with SLIDE_PLANNER_TEST=1. */
    __shell?: ShellTestHook
  }
}
