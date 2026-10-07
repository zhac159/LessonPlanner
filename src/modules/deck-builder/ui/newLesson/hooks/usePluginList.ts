import { useEffect, useState } from 'react'
import { useClient } from '@renderer/sdk'
import { DECK_BUILDER, type DeckBuilderApi } from '@shared/contracts/deck-builder'
import type { PluginSummary } from '@shared/contracts/deck-builder-plugins'

/** The enabled plugins for the "+" menu (`plugins:list`); empty until loaded or if main cannot say. */
export function usePluginList(): PluginSummary[] {
  const deckBuilder = useClient<DeckBuilderApi>(DECK_BUILDER)
  const [plugins, setPlugins] = useState<PluginSummary[]>([])
  useEffect(() => {
    let live = true
    deckBuilder['plugins:list']()
      .then((list) => live && setPlugins([...list].sort((a, b) => a.order - b.order)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [deckBuilder])
  return plugins
}
