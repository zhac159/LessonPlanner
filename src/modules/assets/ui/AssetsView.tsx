import { useEffect, useRef, useState } from 'react'
import { useShell, type ModuleViewProps } from '@renderer/sdk'
import { AssetsPage } from './AssetsPage'
import { libraryRoute, reviewRoute, routeForIntent, type AssetsRoute } from './model/route'
import { ReviewScreen } from './review/ReviewScreen'
import './assets.css'

/**
 * The Assets module's page. Intents (agents/ASSETS.md §3.0): `{ kind: 'library' }` (default), `{ kind: 'review', batchId? }`,
 * `{ kind: 'online', query? }` and `{ kind: 'make', basedOn? }`. Without one it keeps whatever is open.
 */
export function AssetsView({ active }: ModuleViewProps) {
  const { intent, consumeIntent } = useShell()
  const [route, setRoute] = useState<AssetsRoute>(() =>
    intent ? (routeForIntent(intent) ?? libraryRoute()) : libraryRoute()
  )

  // The intent the first render already used is not applied twice.
  const seen = useRef(intent)
  useEffect(() => {
    // A page that is mounted but hidden must not take (consume) an intent meant for the page being opened.
    if (!intent || !active) return
    if (seen.current !== intent) {
      seen.current = intent
      const next = routeForIntent(intent)
      if (next) setRoute(next)
    }
    consumeIntent()
  }, [active, intent, consumeIntent])

  if (route.screen === 'review') {
    return <ReviewScreen key={route.key} onBack={() => setRoute(libraryRoute())} />
  }
  return (
    <AssetsPage
      key={route.key}
      route={route}
      active={active}
      onReview={(batchId) => setRoute(reviewRoute(batchId))}
    />
  )
}
