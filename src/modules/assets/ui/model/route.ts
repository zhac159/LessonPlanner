/** The shape of a navigation intent (the shell's `NavIntent`; copied so this file stays free of renderer imports). */
interface Intent {
  kind: string
  [key: string]: unknown
}

export type AssetsTab = 'library' | 'online'

/** Where the Assets page is: the page with a tab, or the review screen (A2). */
export type AssetsRoute =
  | {
      screen: 'page'
      tab: AssetsTab
      /** Bumps on every intent so the same intent twice still re-applies. */
      key: number
      /** `{ kind: 'online', query }`: search this straight away. */
      onlineQuery?: string
      /** `{ kind: 'make', basedOn }`: open selection mode with these ticked. */
      basedOn?: string[]
    }
  | { screen: 'review'; key: number; batchId?: string }

let keys = 0
const nextKey = (): number => ++keys

export const libraryRoute = (): AssetsRoute => ({ screen: 'page', tab: 'library', key: nextKey() })

export const reviewRoute = (batchId?: string): AssetsRoute => ({
  screen: 'review',
  key: nextKey(),
  batchId
})

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

/**
 * What an intent means: `{ kind: 'library' }`, `{ kind: 'review', batchId? }`, `{ kind: 'online', query? }`
 * and `{ kind: 'make', basedOn? }` (agents/ASSETS.md §3.0). Anything else is ignored (null).
 */
export function routeForIntent(intent: Intent): AssetsRoute | null {
  switch (intent.kind) {
    case 'library':
      return libraryRoute()
    case 'review':
      return reviewRoute(text(intent.batchId))
    case 'online':
      return { screen: 'page', tab: 'online', key: nextKey(), onlineQuery: text(intent.query) }
    case 'make': {
      const basedOn = Array.isArray(intent.basedOn)
        ? intent.basedOn.filter((id): id is string => typeof id === 'string')
        : []
      return { screen: 'page', tab: 'library', key: nextKey(), basedOn }
    }
    default:
      return null
  }
}
