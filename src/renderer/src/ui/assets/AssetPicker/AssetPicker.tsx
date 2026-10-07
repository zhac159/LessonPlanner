import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  filterCounts,
  matchesAssetQuery,
  matchesFilter,
  recentlyUsed,
  type AssetFilterId
} from '@shared/assets/library'
import type { AssetSummary } from '@shared/contracts/assets'
import { TextLink } from '../../atoms/TextLink/TextLink'
import { cx } from '../../atoms/cx'
import { TextField } from '../../forms/TextField/TextField'
import { AssetTile } from '../AssetTile/AssetTile'
import { FilterPills } from '../FilterPills/FilterPills'
import { useRovingGrid } from '../internal/useRovingGrid'
import './AssetPicker.css'

/** What a tile needs; the contract's `AssetSummary` fits. */
export type PickerAsset = Pick<AssetSummary, 'id' | 'name' | 'title' | 'kind' | 'thumbDataUrl'> &
  Partial<Pick<AssetSummary, 'tags' | 'lastUsedAt' | 'createdAt'>> & { description?: string }

/** insert = A4 (adds `{{name}}` to the message), place = A11 (circle), spot = A13 first tab. */
export type PickerMode = 'insert' | 'place' | 'spot'

const SUGGESTED_LABEL: Record<PickerMode, string> = {
  insert: 'RECENTLY USED',
  place: 'SUGGESTED FOR THIS SLIDE',
  spot: 'SUGGESTED FOR THIS SPOT'
}

export interface AssetPickerProps {
  mode: PickerMode
  assets: readonly PickerAsset[]
  /** The first section. Defaults to the newest used (insert) or nothing (place, spot). */
  featured?: readonly PickerAsset[]
  /** `single`: one is chosen at a time (the pick is highlighted). `multi`: picks toggle. */
  selection?: 'single' | 'multi'
  selectedIds?: readonly string[]
  onPick: (assetId: string) => void
  /** Search and filter are held here unless the parent controls them (to ask main instead). */
  query?: string
  onQueryChange?: (query: string) => void
  filter?: AssetFilterId
  onFilterChange?: (filter: AssetFilterId) => void
  /** Typed-token mode (`{{sch`): the search box is hidden and this text filters the list. */
  typedQuery?: string
  searchPlaceholder?: string
  /** Put focus on the first tile when it opens. */
  autoFocus?: boolean
  onEscape?: () => void
  onOpenLibrary?: () => void
  onFindOnline?: () => void
  className?: string
}

/**
 * The shared picker (A4, A11, A13): search, kind pills, a "recently used" or "suggested" row and "ALL ASSETS · N".
 * One tab stop, arrows move across both sections, Enter or click picks. It never places anything itself.
 */
export function AssetPicker({
  mode,
  assets,
  featured,
  selection = 'single',
  selectedIds = [],
  onPick,
  query: queryProp,
  onQueryChange,
  filter: filterProp,
  onFilterChange,
  typedQuery,
  searchPlaceholder = 'Search: logo, beaker, owl…',
  autoFocus = false,
  onEscape,
  onOpenLibrary,
  onFindOnline,
  className
}: AssetPickerProps) {
  const [queryState, setQueryState] = useState('')
  const [filterState, setFilterState] = useState<AssetFilterId>('all')
  const typed = typedQuery !== undefined
  const query = typed ? typedQuery : (queryProp ?? queryState)
  const filter = filterProp ?? filterState

  const counts = useMemo(() => filterCounts(assets), [assets])
  const keep = (asset: PickerAsset): boolean =>
    matchesFilter(asset, filter) &&
    matchesAssetQuery(
      { ...asset, tags: asset.tags ?? [], description: asset.description ?? '' },
      query
    )
  const all = useMemo(
    () => assets.filter(keep),
    [assets, filter, query] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const top = (
    featured ?? (mode === 'insert' ? recentlyUsed(assets.map((a) => ({ ...a, ...stamp(a) }))) : [])
  ).filter(keep)

  const keys = [...top.map((a) => `top:${a.id}`), ...all.map((a) => `all:${a.id}`)]
  const roving = useRovingGrid(keys, 3)
  useEffect(() => {
    if (autoFocus) roving.focusFirst()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setQuery = (next: string): void => {
    setQueryState(next)
    onQueryChange?.(next)
  }
  const setFilter = (next: AssetFilterId): void => {
    setFilterState(next)
    onFilterChange?.(next)
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      event.stopPropagation()
      onEscape()
    }
  }
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      roving.focusFirst()
    } else if (event.key === 'Enter' && all[0]) {
      event.preventDefault()
      onPick(all[0].id)
    }
  }

  const tile = (asset: PickerAsset, prefix: 'top' | 'all'): ReactNode => (
    <AssetTile
      key={`${prefix}:${asset.id}`}
      name={asset.name}
      thumbSrc={asset.thumbDataUrl}
      selected={selectedIds.includes(asset.id)}
      itemProps={roving.itemProps(`${prefix}:${asset.id}`)}
      onClick={() => onPick(asset.id)}
    />
  )

  const empty = assets.length === 0
  return (
    <div
      className={cx('as-picker', className)}
      onKeyDown={onRootKeyDown}
      data-selection={selection}
    >
      {!typed && (
        <TextField
          label="Search assets"
          hideLabel
          variant="search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
      )}
      {!empty && (
        <FilterPills
          counts={counts}
          value={filter}
          onChange={setFilter}
          showCount={false}
          scroll
          hide={['symbol-cards']}
        />
      )}
      <div ref={roving.containerRef} className="as-picker__lists" onKeyDown={roving.onKeyDown}>
        {top.length > 0 && (
          <section aria-label={SUGGESTED_LABEL[mode]}>
            <h3 className="as-picker__label">{SUGGESTED_LABEL[mode]}</h3>
            <div className="as-picker__grid">{top.map((a) => tile(a, 'top'))}</div>
          </section>
        )}
        {all.length > 0 && (
          <section aria-label="All assets">
            <h3 className="as-picker__label">{`ALL ASSETS · ${all.length}`}</h3>
            <div className="as-picker__grid">{all.map((a) => tile(a, 'all'))}</div>
          </section>
        )}
      </div>
      {empty ? (
        <p className="as-picker__empty">
          {"You don't have any assets yet."}
          <span className="as-picker__links">
            {onOpenLibrary && <TextLink onClick={onOpenLibrary}>Open library</TextLink>}
            {onFindOnline && <TextLink onClick={onFindOnline}>Find online</TextLink>}
          </span>
        </p>
      ) : (
        all.length === 0 && (
          <p className="as-picker__empty" role="status">
            {query.trim() ? `No asset called “${query.trim()}”.` : 'Nothing here.'}
          </p>
        )
      )}
      {mode === 'insert' && !empty && (
        <footer className="as-picker__foot">
          <span>
            Tip: type <strong>{'{{'}</strong> in the chat to pick one
          </span>
          {onOpenLibrary && <TextLink onClick={onOpenLibrary}>Open library</TextLink>}
        </footer>
      )}
    </div>
  )
}

/** `recentlyUsed` needs both stamps; picker assets may lack them (then they never count as recent). */
const stamp = (asset: PickerAsset): { lastUsedAt: string | null; createdAt: string } => ({
  lastUsedAt: asset.lastUsedAt ?? null,
  createdAt: asset.createdAt ?? ''
})
