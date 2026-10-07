import { useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'

/** The plugins for the "+" menu, in display order (06 §6). Empty until main answers, and if it cannot. */
export function usePlugins(): { plugins: PluginSummary[]; loaded: boolean } {
  const client = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [state, setState] = useState<{ plugins: PluginSummary[]; loaded: boolean }>({
    plugins: [],
    loaded: false
  })
  useEffect(() => {
    let live = true
    client['plugins:list']()
      .then((plugins) => live && setState({ plugins, loaded: true }))
      .catch(() => live && setState({ plugins: [], loaded: true }))
    return () => {
      live = false
    }
  }, [client])
  return state
}
