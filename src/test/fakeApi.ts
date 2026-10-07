/**
 * `window.api` for component tests (the real one is injected by the Electron preload).
 *
 *   const api = installFakeWindowApi({ window: { isMaximized: async () => true } })
 *   expect(api.window.minimize).toHaveBeenCalled()
 *
 * Every function is a `vi.fn`. `modules.invoke` rejects (modules are faked with clients instead:
 * see ./fakeClients.ts). Overrides replace single members of the groups `app`, `window`, `files`,
 * `modules`, or the plain `platform` / `testMode` values. Call the returned `restore()` (or let the
 * next test overwrite it) to remove the fake.
 */
import { vi } from 'vitest'
import type { PlanningApi } from '@shared/api'

export type ApiOverrides = {
  [K in keyof PlanningApi]?: PlanningApi[K] extends object
    ? Partial<PlanningApi[K]>
    : PlanningApi[K]
}

export type FakeWindowApi = PlanningApi & { restore(): void }

export function createFakeApi(overrides: ApiOverrides = {}): PlanningApi {
  return {
    platform: overrides.platform ?? 'win32',
    testMode: overrides.testMode ?? false,
    app: {
      getInfo: vi.fn(async () => ({
        name: 'Slide Planner',
        version: '0.0.0-test',
        electron: '0',
        chrome: '0',
        node: '0',
        platform: 'win32',
        isPackaged: false
      })),
      ...overrides.app
    },
    window: {
      minimize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      setFullScreen: vi.fn(),
      isMaximized: vi.fn(async () => false),
      onMaximizedChange: vi.fn(() => () => {}),
      ...overrides.window
    },
    files: {
      pathFor: vi.fn((file: File) => `/fake/${file.name}`),
      ...overrides.files
    },
    modules: {
      invoke: vi.fn(async (moduleId: string, channel: string) => {
        throw new Error(`fake window.api: ${moduleId}:${channel} is not faked (use fake clients)`)
      }) as PlanningApi['modules']['invoke'],
      on: vi.fn(() => () => {}),
      ...overrides.modules
    }
  }
}

/** Sets `window.api` to a fake and returns it, plus `restore()` to remove it again. */
export function installFakeWindowApi(overrides: ApiOverrides = {}): FakeWindowApi {
  const api = createFakeApi(overrides)
  const previous = (window as { api?: PlanningApi }).api
  window.api = api
  return {
    ...api,
    restore: () => {
      if (previous) window.api = previous
      else delete (window as { api?: PlanningApi }).api
    }
  }
}
