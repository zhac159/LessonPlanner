import type { PlanningApi } from '@shared/api'
import type { ModuleApi } from './types'

/** A module's private line to its main half. `bridge` defaults to the preload's `window.api.modules`. */
export function createModuleApi(
  moduleId: string,
  bridge: () => PlanningApi['modules'] = () => window.api.modules
): ModuleApi {
  return {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) =>
      bridge().invoke<T>(moduleId, channel, ...args),
    on: (channel, listener) => bridge().on(moduleId, channel, listener)
  }
}
