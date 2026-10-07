/**
 * The API surface for renderer module entries (src/modules/<id>/ui.tsx and ui/).
 * Modules should import from here, from '@ui/*' and from '@shared/*' only, never from other renderer internals.
 */
import type { UiModule } from './core/types'

export type {
  ChromeMode,
  IconProps,
  ModuleApi,
  ModuleViewProps,
  NavIntent,
  NavPlacement,
  ShellState,
  ShellUser,
  UiModule
} from './core/types'
export { useShell } from './core/ShellContext'
export { contractClient } from './core/contractClient'
export { useClient, useEvent } from './core/hooks'

/** Identity helper that types a module definition. Default-export the result from ui.tsx. */
export function defineUiModule(module: UiModule): UiModule {
  return module
}
