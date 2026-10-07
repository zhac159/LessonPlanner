import { useEffect, useRef } from 'react'
import type { ShellState } from './types'
import { useShell } from './ShellContext'

/** What e2e and visual scripts see as `window.__shell` (only when the app runs with SLIDE_PLANNER_TEST=1). */
export interface ShellTestHook {
  navigate: ShellState['navigate']
  getState(): ShellState
}

/** Exposes `window.__shell` in test mode so scripts can jump straight to a screen. A no-op otherwise. */
export function useShellTestHook(): void {
  const shell = useShell()
  const latest = useRef(shell)
  useEffect(() => {
    latest.current = shell
  })
  const enabled = window.api?.testMode === true
  const { navigate } = shell
  useEffect(() => {
    if (!enabled) return
    window.__shell = { navigate, getState: () => latest.current }
    return () => {
      delete window.__shell
    }
  }, [enabled, navigate])
}
