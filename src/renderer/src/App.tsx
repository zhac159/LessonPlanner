import { useCallback, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ModuleHost } from './components/ModuleHost'
import { Sidebar } from './components/Sidebar'
import { Splash } from './components/Splash'
import { TitleBar } from './components/TitleBar'
import { ToastProvider } from '@ui/overlays'
import { ShellProvider } from './core/ShellProvider'
import { useShell } from './core/ShellContext'
import type { ShellState } from './core/types'
import { useShellTestHook } from './core/useShellTestHook'
import { useUiModules } from './core/useUiModules'
import './App.css'

/**
 * splash:    welcome animation is playing; the shell is already mounted underneath, but hidden.
 * revealing: the splash is fading out while the shell fades in.
 * app:       splash gone, the app is fully visible.
 */
type Phase = 'splash' | 'revealing' | 'app'

const NO_MODULES: ShellState['modules'] = []
const NO_ISSUES: ShellState['issues'] = []

export function App() {
  const registry = useUiModules()
  const ready = registry.status === 'ready'
  return (
    <ShellProvider
      modules={ready ? registry.modules : NO_MODULES}
      issues={ready ? registry.issues : NO_ISSUES}
    >
      <ToastProvider>
        <AppFrame modulesReady={ready} />
      </ToastProvider>
    </ShellProvider>
  )
}

/** The window layout. `data-chrome` tells the stylesheet which chrome (none / sidebar / rail) to show. */
function AppFrame({ modulesReady }: { modulesReady: boolean }) {
  const { chrome } = useShell()
  const [phase, setPhase] = useState<Phase>('splash')
  useShellTestHook()

  const handleExitStart = useCallback(() => setPhase('revealing'), [])
  const handleDone = useCallback(() => setPhase('app'), [])

  return (
    <div className="app" data-phase={phase}>
      <TitleBar floating={phase === 'splash'} />
      <div className="shell" data-testid="shell" data-chrome={chrome} inert={phase === 'splash'}>
        <ErrorBoundary scope="shell">
          <Sidebar />
          <ModuleHost />
        </ErrorBoundary>
      </div>
      {phase !== 'app' && (
        <Splash ready={modulesReady} onExitStart={handleExitStart} onDone={handleDone} />
      )}
    </div>
  )
}
