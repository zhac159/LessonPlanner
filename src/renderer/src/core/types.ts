import type { ComponentType } from 'react'
import type { RegistryIssue } from '@shared/registry'

/** The props a module icon must accept. Every lucide-react icon satisfies this. */
export interface IconProps {
  size?: number | string
  strokeWidth?: number
  className?: string
}

/** A module's private line to its own main-process half. Pre-bound to the module id. */
export interface ModuleApi {
  /** Call a handler the module registered in main.ts with `ctx.handle(channel, ...)`. */
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  /** Listen to events the module's main.ts sends with `ctx.emit(channel, payload)`. */
  on(channel: string, listener: (payload: unknown) => void): () => void
}

/** Why the shell was asked to open a module ("open lesson X", "open Settings > AI"). */
export interface NavIntent {
  kind: string
  [key: string]: unknown
}

export interface ModuleViewProps {
  api: ModuleApi
  /**
   * True while this module is the visible one. A module stays mounted after it is first opened
   * (so its state survives navigation); use this to pause timers, polling or animation.
   */
  active: boolean
}

/** Window chrome around a module: TitleBar only, TitleBar + 224px Sidebar, or TitleBar + 72px rail. */
export type ChromeMode = 'none' | 'sidebar' | 'rail'

/** Where a module's sidebar item appears. `hidden` modules are reachable only via `navigate`. */
export type NavPlacement = 'top' | 'bottom' | 'hidden'

export interface UiModule {
  /** Must equal the module's folder name (lowercase kebab-case). */
  id: string
  /** Sidebar label. */
  title: string
  /** Sidebar icon, e.g. `import { Sparkles } from 'lucide-react'`. */
  icon: ComponentType<IconProps>
  /** Sidebar position, ascending. Defaults to 100. */
  order?: number
  /** Sidebar placement. Defaults to 'top'. */
  nav?: NavPlacement
  /** Default chrome while this module is active. Defaults to 'sidebar'. A module may override at runtime with `setChrome`. */
  chrome?: ChromeMode
  /** The module's page. Use `lazy(() => import(...))` for heavy views. */
  component: ComponentType<ModuleViewProps>
}

export interface ShellUser {
  name: string
  /** True when an API key is stored (drives the sidebar's "Claude connected" status). */
  claudeConnected: boolean
}

export interface ShellState {
  /** Successfully loaded modules, in sidebar order. */
  modules: ReadonlyArray<UiModule>
  /** Modules that failed to load or validate. */
  issues: ReadonlyArray<RegistryIssue>
  /** Id of the visible module. */
  activeId: string
  /** Switch to another module by id, optionally with an intent the target reads via `intent`. */
  navigate(id: string, intent?: NavIntent): void
  /** The pending intent for the active module (set by `navigate`), or null. */
  intent: NavIntent | null
  /** Mark the intent as handled so it is not replayed. */
  consumeIntent(): void
  /** Effective chrome right now (the active module's override, else its default). */
  chrome: ChromeMode
  /** Override the chrome for the active module; pass null to restore the module default. */
  setChrome(mode: ChromeMode | null): void
  /** The signed-in-less local user, or null before onboarding finishes. */
  user: ShellUser | null
  /** Re-read the user (call after saving name / key in settings). */
  refreshUser(): Promise<void>
}
