import type { KeyboardEvent } from 'react'
import type { AssetSummary } from '@shared/contracts/assets'
import { AssetCard, AssetGrid } from '@ui/assets'
import { Callout, Button, TextLink } from '@ui/atoms'

export interface LibraryGridProps {
  items: readonly AssetSummary[]
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** The search text, for "Nothing matches “…”". */
  search: string
  selectedId: string | null
  onSelect(id: string): void
  selecting: boolean
  isTicked(id: string): boolean
  onTick(asset: AssetSummary, on: boolean): void
  onClearSearch(): void
  onRetry(): void
  /** Delete pressed on a focused card. */
  onDeleteKey(asset: AssetSummary): void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore(): void
}

/** Six placeholder cards while the first answer is on its way. */
function Skeletons() {
  return (
    <div className="as-skeletons" aria-busy="true" aria-label="Loading your assets" role="group">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="as-skeleton" />
      ))}
    </div>
  )
}

/** The cards: loading skeletons, an error with Retry, "Nothing matches", or the grid itself. */
export function LibraryGrid({
  items,
  status,
  error,
  search,
  selectedId,
  onSelect,
  selecting,
  isTicked,
  onTick,
  onClearSearch,
  onRetry,
  onDeleteKey,
  hasMore,
  loadingMore,
  onLoadMore
}: LibraryGridProps) {
  if (status === 'loading') return <Skeletons />
  if (status === 'error') {
    return (
      <Callout
        variant="error"
        action={
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Callout>
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Delete') return
    const key = (event.target as HTMLElement).dataset?.gridKey
    const asset = items.find((a) => a.id === key)
    if (asset) onDeleteKey(asset)
  }

  return (
    <div className="as-library__cards" onKeyDown={onKeyDown}>
      <AssetGrid
        label="Your assets"
        items={items}
        getKey={(asset) => asset.id}
        empty={
          <p className="as-nomatch" role="status">
            {search ? `Nothing matches “${search}”.` : 'Nothing here.'}{' '}
            {search && <TextLink onClick={onClearSearch}>Clear search</TextLink>}
          </p>
        }
        renderItem={(asset, itemProps) => (
          <AssetCard
            title={asset.title}
            name={asset.name}
            kind={asset.kind}
            usedInCount={asset.usedInCount}
            thumbSrc={asset.thumbDataUrl}
            selected={asset.id === selectedId}
            selectable={selecting}
            checked={isTicked(asset.id)}
            onSelect={() => onSelect(asset.id)}
            onCheckedChange={(on) => onTick(asset, on)}
            itemProps={itemProps}
          />
        )}
      />
      {hasMore && (
        <Button variant="secondary" shape="pill" loading={loadingMore} onClick={onLoadMore}>
          Show more
        </Button>
      )}
    </div>
  )
}
