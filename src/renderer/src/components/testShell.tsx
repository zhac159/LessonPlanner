import type { ReactNode } from 'react'
import { ShellContext } from '../core/ShellContext'
import type { ShellState } from '../core/types'

/** A complete ShellState for component tests; override only what the test cares about. */
export function makeShell(overrides: Partial<ShellState> = {}): ShellState {
  return {
    modules: [],
    issues: [],
    activeId: '',
    navigate: () => {},
    intent: null,
    consumeIntent: () => {},
    chrome: 'sidebar',
    setChrome: () => {},
    user: { name: 'Alice', claudeConnected: true },
    refreshUser: async () => {},
    ...overrides
  }
}

/** Wrap children in a ShellContext (tests for the shell's own components). */
export function ShellProvider({
  shell,
  children
}: {
  shell?: Partial<ShellState>
  children: ReactNode
}) {
  return <ShellContext.Provider value={makeShell(shell)}>{children}</ShellContext.Provider>
}
