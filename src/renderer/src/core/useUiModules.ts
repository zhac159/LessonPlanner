import { useEffect, useState } from 'react'
import type { LoadedModules } from '@shared/registry'
import { loadUiModules } from './loadUiModules'
import type { UiModule } from './types'

export type UiModulesState = { status: 'loading' } | ({ status: 'ready' } & LoadedModules<UiModule>)

export function useUiModules(): UiModulesState {
  const [state, setState] = useState<UiModulesState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    void loadUiModules().then((result) => {
      if (!cancelled) setState({ status: 'ready', ...result })
    })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
