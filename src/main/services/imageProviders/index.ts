/**
 * Image provider layer: search free image libraries (Openverse, Wikimedia Commons, optional Pexels/Unsplash),
 * download a chosen picture safely, make pictures with Nano Banana Pro, and build credit lines.
 * Pure TypeScript over an injected `fetchFn`; it is wired to IPC by a module's `main.ts`, never imported in the renderer.
 */
import { createCommonsProvider } from './commons'
import { polite, type Clock } from './limits'
import { createPexelsProvider, createUnsplashProvider } from './keyed'
import { createOpenverseProvider } from './openverse'
import type { FetchFn, ImageSearchProvider } from './types'

export * from './attribution'
export * from './commons'
export * from './download'
export * from './errors'
export * from './keyed'
export * from './licences'
export * from './limits'
export * from './nanoBanana'
export * from './openverse'
export * from './types'

export interface SearchProviderSetup {
  fetchFn: FetchFn
  userAgent?: string
  /** Optional free keys (read on every search; undefined means "not set up"). */
  getPexelsKey?: () => string | undefined
  getUnsplashKey?: () => string | undefined
  getOpenverseToken?: () => string | undefined
  clock?: Clock
}

/**
 * The providers the "Find online" tab can search, each already throttled and cached. Openverse and Commons always
 * exist; Pexels and Unsplash appear only when a key getter is given.
 */
export function createSearchProviders(setup: SearchProviderSetup): ImageSearchProvider[] {
  const { fetchFn, userAgent, clock } = setup
  const providers: ImageSearchProvider[] = [
    polite(createOpenverseProvider({ fetchFn, userAgent, getToken: setup.getOpenverseToken }), {
      minGapMs: 3_500,
      clock
    }),
    polite(createCommonsProvider({ fetchFn, userAgent }), { minGapMs: 500, clock })
  ]
  if (setup.getPexelsKey) {
    providers.push(
      polite(createPexelsProvider({ fetchFn, userAgent, getKey: setup.getPexelsKey }), {
        minGapMs: 500,
        clock
      })
    )
  }
  if (setup.getUnsplashKey) {
    providers.push(
      polite(createUnsplashProvider({ fetchFn, userAgent, getKey: setup.getUnsplashKey }), {
        minGapMs: 500,
        clock
      })
    )
  }
  return providers
}
