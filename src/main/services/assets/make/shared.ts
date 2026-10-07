import type { MakeService } from './service'

let shared: MakeService | null = null

/**
 * The running make service, registered by `createMakeApi`, so the deck-builder's `placeAsset` can take a made
 * picture (`{ kind: 'made', jobId, version }`) with `getSharedMake()?.keepVersion(...)`.
 */
export const getSharedMake = (): MakeService | null => shared
export const setSharedMake = (next: MakeService | null): void => {
  shared = next
}
