import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RegistryIssue } from '@shared/registry'
import { SETTINGS, type SettingsApi } from '@shared/contracts/settings'
import { ClientsProvider, type Clients } from './ClientsContext'
import { useClient } from './hooks'
import { readOnboarding, type OnboardingState } from './onboarding'
import { ShellContext } from './ShellContext'
import type { ChromeMode, NavIntent, ShellState, UiModule } from './types'
import { useGlobalShortcuts } from './useGlobalShortcuts'

export interface ShellProviderProps {
  modules: ReadonlyArray<UiModule>
  issues: ReadonlyArray<RegistryIssue>
  /** Override how modules are reached (tests). Defaults to the clients from context, i.e. `window.api`. */
  clients?: Clients
  children: ReactNode
}

const DEFAULT_CHROME: ChromeMode = 'sidebar'
const PENDING: OnboardingState = { firstRun: false, user: null }

/**
 * Owns the shell's state: which module is active (and why: the navigation intent), the chrome mode,
 * the local user, first-run routing and the global shortcuts. Rendering stays in App.tsx.
 */
export function ShellProvider({ clients, ...props }: ShellProviderProps) {
  if (!clients) return <ShellStateHolder {...props} />
  return (
    <ClientsProvider clients={clients}>
      <ShellStateHolder {...props} />
    </ClientsProvider>
  )
}

function ShellStateHolder({ modules, issues, children }: Omit<ShellProviderProps, 'clients'>) {
  const settings = useClient<SettingsApi>(SETTINGS)
  const [requestedId, setRequestedId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ moduleId: string; intent: NavIntent } | null>(null)
  const [chromeOverrides, setChromeOverrides] = useState<Record<string, ChromeMode>>({})
  const [onboarding, setOnboarding] = useState<OnboardingState>(PENDING)

  const activeId = modules.find((m) => m.id === requestedId)?.id ?? modules[0]?.id ?? ''
  const hasSettings = modules.some((m) => m.id === SETTINGS)

  const navigate = useCallback(
    (id: string, intent?: NavIntent) => {
      if (!modules.some((m) => m.id === id)) {
        console.warn(`navigate("${id}") ignored: no such module`)
        return
      }
      setRequestedId(id)
      setPending(intent ? { moduleId: id, intent } : null)
    },
    [modules]
  )

  const consumeIntent = useCallback(() => setPending(null), [])

  // Stable identity (modules call it from effects) but always applied to the module active at call time.
  const activeRef = useRef(activeId)
  useEffect(() => {
    activeRef.current = activeId
  })
  const setChrome = useCallback((mode: ChromeMode | null) => {
    const target = activeRef.current
    setChromeOverrides((current) => {
      const { [target]: _previous, ...rest } = current
      return mode ? { ...rest, [target]: mode } : rest
    })
  }, [])

  const refreshUser = useCallback(async () => {
    if (hasSettings) setOnboarding(await readOnboarding(settings))
  }, [hasSettings, settings])

  // First run: once the modules are known, send a user without a finished profile to Settings.
  useEffect(() => {
    if (!hasSettings) return
    let cancelled = false
    void readOnboarding(settings).then((state) => {
      if (cancelled) return
      setOnboarding(state)
      if (state.firstRun) navigate(SETTINGS, { kind: 'first-run' })
    })
    return () => {
      cancelled = true
    }
  }, [hasSettings, settings, navigate])

  useGlobalShortcuts(!onboarding.firstRun, navigate)

  const active = modules.find((m) => m.id === activeId)
  const chrome = chromeOverrides[activeId] ?? active?.chrome ?? DEFAULT_CHROME
  const intent = pending && pending.moduleId === activeId ? pending.intent : null

  const shell = useMemo<ShellState>(
    () => ({
      modules,
      issues,
      activeId,
      navigate,
      intent,
      consumeIntent,
      chrome,
      setChrome,
      user: onboarding.user,
      refreshUser
    }),
    [
      modules,
      issues,
      activeId,
      navigate,
      intent,
      consumeIntent,
      chrome,
      setChrome,
      onboarding.user,
      refreshUser
    ]
  )

  return <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>
}
