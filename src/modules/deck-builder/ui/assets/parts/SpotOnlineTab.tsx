import { OnlineFilters, OnlineResultCard, OnlineSearchBar, useRovingGrid } from '@ui/assets'
import { Callout } from '@ui/atoms'
import type { OnlineState } from '../hooks/useOnlineSearch'
import { SavedAsLine, type SavedAsLineProps } from './SavedAsLine'
import './sheets.css'

/** Three rows are enough in a side sheet: a different search beats scrolling, and the fit choice stays in view. */
export const MAX_SHOWN = 9

export interface SpotOnlineTabProps {
  state: OnlineState
  query: string
  onQueryChange(query: string): void
  onSearch(): void
  freeToUse: boolean
  onFreeToUseChange(on: boolean): void
  selectedId: string | null
  onSelect(resultId: string): void
  saved: SavedAsLineProps | null
}

/** "Find online" tab of A13: the search is already done with the spot's words; pick a result, see it in the spot. */
export function SpotOnlineTab({
  state,
  query,
  onQueryChange,
  onSearch,
  freeToUse,
  onFreeToUseChange,
  selectedId,
  onSelect,
  saved
}: SpotOnlineTabProps) {
  const shown = state.results.slice(0, MAX_SHOWN)
  const keys = shown.map((r) => r.id)
  const roving = useRovingGrid(keys, 3)
  const busy = state.status === 'searching'
  return (
    <>
      <OnlineSearchBar
        size="md"
        value={query}
        onChange={onQueryChange}
        onSearch={onSearch}
        busy={busy}
      />
      <OnlineFilters
        freeToUse={freeToUse}
        onFreeToUseChange={onFreeToUseChange}
        kind="any"
        onKindChange={() => undefined}
        hideKind
      />
      {state.status === 'error' && <Callout variant="error">{state.message}</Callout>}
      {state.status === 'done' && state.results.length === 0 && (
        <p className="deck-spot__empty" role="status">
          Nothing found for “{query.trim()}”. Try other words.
        </p>
      )}
      <div
        ref={roving.containerRef}
        className="deck-spot__grid"
        onKeyDown={roving.onKeyDown}
        aria-label="Search results"
        role="group"
      >
        {shown.map((result) => (
          <OnlineResultCard
            key={result.id}
            compact
            title={result.title}
            providerLabel={result.providerLabel}
            licence={result.licence}
            thumbSrc={result.thumbDataUrl}
            selected={result.id === selectedId}
            onSelect={() => onSelect(result.id)}
            itemProps={roving.itemProps(result.id)}
          />
        ))}
      </div>
      {saved && <SavedAsLine {...saved} />}
    </>
  )
}
