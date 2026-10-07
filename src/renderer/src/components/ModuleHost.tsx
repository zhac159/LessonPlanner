import { Suspense, useMemo, useState } from 'react'
import { createModuleApi } from '../core/createModuleApi'
import { useShell } from '../core/ShellContext'
import type { UiModule } from '../core/types'
import { ErrorBoundary } from './ErrorBoundary'
import './ModuleHost.css'

function ModuleSlot({ module, active }: { module: UiModule; active: boolean }) {
  const api = useMemo(() => createModuleApi(module.id), [module.id])
  const View = module.component
  return (
    <section
      className="module-slot"
      hidden={!active}
      aria-label={module.title}
      data-testid={`module-${module.id}`}
    >
      <ErrorBoundary scope={`module:${module.id}`} title="This module hit a problem">
        <Suspense fallback={<div className="module-loading" aria-busy="true" />}>
          <View api={api} active={active} />
        </Suspense>
      </ErrorBoundary>
    </section>
  )
}

/**
 * Renders the active module. A module is mounted the first time it is opened and then kept
 * mounted (hidden) so its state, such as an in-progress chat, survives switching away.
 */
export function ModuleHost() {
  const { modules, issues, activeId } = useShell()
  const [visited, setVisited] = useState<string[]>([])

  if (activeId && !visited.includes(activeId)) setVisited([...visited, activeId])

  if (modules.length === 0) {
    return (
      <main className="module-host">
        <div className="module-error" role="alert">
          <h2>No modules loaded</h2>
          <p>
            {issues.length > 0
              ? issues.map((issue) => `${issue.moduleId}: ${issue.message}`).join(' | ')
              : 'Add a folder under src/modules/ with a ui.tsx entry.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="module-host">
      {modules
        .filter((module) => visited.includes(module.id))
        .map((module) => (
          <ModuleSlot key={module.id} module={module} active={module.id === activeId} />
        ))}
    </main>
  )
}
