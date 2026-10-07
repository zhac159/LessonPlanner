/** Test-only helpers for the deck-builder wiring. */
import type { StyleProfileView } from '@shared/contracts/style-library'
import { fixtureStyle } from '@shared/deck/testing'
import type { StyleProfile } from '@shared/style/types'
import type { StyleLookup } from './sharedStyles'

/** A stand-in for the shared styles: the Science KS3 profile, and a minimal view of it. */
export function fakeStyleLookup(profile: StyleProfile = fixtureStyle()): StyleLookup {
  return {
    getProfile: async (id) => (id === profile.id ? profile : undefined),
    viewOf: async (id) =>
      id === profile.id ? ({ name: profile.name } as unknown as StyleProfileView) : null
  }
}
