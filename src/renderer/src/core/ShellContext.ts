import { createContext, useContext } from 'react'
import type { ShellState } from './types'

export const ShellContext = createContext<ShellState | null>(null)

/** Read the shell: loaded modules, load issues, the active module and `navigate(id)`. */
export function useShell(): ShellState {
  const shell = useContext(ShellContext)
  if (!shell) throw new Error('useShell() must be used inside the app shell')
  return shell
}
