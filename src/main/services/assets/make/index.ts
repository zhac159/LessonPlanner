/**
 * The make-new service (agents/ASSETS.md §3.8, §5.6): "Make a new one like these" on A8 and "Make one" on A13.
 *
 * Wiring (assets module main): `make: createMakeApi({ assets, ai, emit, settingsDir, fake, log })` in
 * `createAssetsApi`. It also registers the service for `getSharedMake()`, which the deck-builder's `placeAsset`
 * uses for `{ kind: 'made', jobId, version }` sources.
 */
import type { MakeApiImpl, MakeServiceDeps } from './types'
import { setSharedMake } from './shared'
import { MakeService } from './service'

export * from './types'
export { MakeService } from './service'
export { getSharedMake, setSharedMake } from './shared'

/** The four `make:*` handlers. Builds the service, registers it as the shared one and serves it. */
export function createMakeApi(deps: MakeServiceDeps): MakeApiImpl {
  const service = new MakeService(deps)
  setSharedMake(service)
  return service.api()
}
