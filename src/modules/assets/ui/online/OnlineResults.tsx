import { AssetGrid, OnlineResultCard } from '@ui/assets'
import { Button } from '@ui/atoms'
import type { OnlineState } from '../hooks/useOnline'

/** The 3-column result cards (or six skeletons while searching), and "Show more". */
export function OnlineResults({ online }: { online: OnlineState }) {
  if (online.status === 'busy') {
    return (
      <div
        className="as-skeletons as-skeletons--results"
        aria-busy="true"
        role="group"
        aria-label="Searching"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="as-skeleton" />
        ))}
      </div>
    )
  }
  return (
    <div className="as-library__cards">
      <AssetGrid
        label="Search results"
        layout="results"
        items={online.results}
        getKey={(result) => result.id}
        renderItem={(result, itemProps) => (
          <OnlineResultCard
            title={result.title}
            providerLabel={result.providerLabel}
            licence={result.licence}
            thumbSrc={result.thumbDataUrl}
            selected={online.selected?.id === result.id}
            checkable
            checked={online.checked.has(result.id)}
            onSelect={() => online.select(result.id)}
            onCheckedChange={(on) => online.toggle(result.id, on)}
            itemProps={itemProps}
          />
        )}
      />
      {online.hasMore && (
        <Button variant="secondary" shape="pill" loading={online.loadingMore} onClick={online.more}>
          Show more
        </Button>
      )}
    </div>
  )
}
