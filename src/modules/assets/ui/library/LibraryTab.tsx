import { Images } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { useShell } from '@renderer/sdk'
import { SelectionBar } from '@ui/assets'
import { Button, EmptyState } from '@ui/atoms'
import { ConfirmDialog, ContextMenu, useToast } from '@ui/overlays'
import type { AssetActions } from '../hooks/useAssetActions'
import { useLessonLinks } from '../hooks/useLessonLinks'
import type { Library } from '../hooks/useLibrary'
import { useMakeNew } from '../hooks/useMakeNew'
import { TOO_MANY, useSelection } from '../hooks/useSelection'
import type { LibraryFilters } from '../hooks/useLibrary'
import { MakePane } from '../make/MakePane'
import { DetailPane } from './DetailPane'
import { LibraryGrid } from './LibraryGrid'
import { LibraryToolbar } from './LibraryToolbar'
import { PendingBanner } from './PendingBanner'

export interface LibraryTabProps {
  library: Library
  filters: LibraryFilters
  onFilterChange(next: Partial<LibraryFilters>): void
  active: boolean
  /** `{ kind: 'make', basedOn }`: these start out ticked. */
  basedOnIds?: readonly string[]
  actions: AssetActions
  onReview(): void
  onFindOnline(): void
}

/** A1 and A8: the grid with its banner and filters, and the detail pane or (in selection mode) the make panel. */
export function LibraryTab({
  library,
  filters,
  onFilterChange,
  active,
  basedOnIds,
  actions,
  onReview,
  onFindOnline
}: LibraryTabProps) {
  const { navigate } = useShell()
  const toast = useToast()
  const selection = useSelection(library.items)
  const links = useLessonLinks(active)
  const maker = useMakeNew(selection.ticked)
  const pane = useRef<HTMLDivElement>(null)
  const { page } = library

  // `{ kind: 'make', basedOn }`: tick those once their cards are loaded.
  const pending = useRef(basedOnIds)
  const { setSelecting, tick } = selection
  useEffect(() => {
    const wanted = pending.current
    if (!wanted?.length || library.items.length === 0) return
    pending.current = undefined
    setSelecting(true)
    for (const id of wanted) {
      const asset = library.items.find((a) => a.id === id)
      if (asset) tick(asset, true)
    }
  }, [library.items, setSelecting, tick])

  const onTick = useCallback(
    (asset: Parameters<typeof tick>[0], on: boolean) => {
      if (!tick(asset, on)) toast.show({ message: TOO_MANY })
    },
    [tick, toast]
  )

  const setSelectingMode = (on: boolean): void => {
    if (!on && maker.stop()) toast.show({ message: 'Stopped. Nothing was saved.' })
    setSelecting(on)
  }

  const makeOpen = selection.selecting && selection.ticked.length > 0
  const empty = page !== null && page.libraryCount === 0
  const search = filters.search.trim()

  if (empty && library.status === 'ready') {
    return (
      <>
        {page.pendingReview && <PendingBanner pending={page.pendingReview} onReview={onReview} />}
        <EmptyState
          icon={<Images />}
          title="No assets yet"
          actions={
            <>
              <Button variant="primary" onClick={() => void actions.pick()}>
                Upload
              </Button>
              <Button onClick={onFindOnline}>Find online</Button>
            </>
          }
        >
          Upload pictures, or let Slide Planner find the ones in your old decks when you learn a
          style.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      {selection.selecting && (
        <SelectionBar
          count={selection.ticked.length}
          hint="Pick a few that show the look you want"
          actionLabel="Make a new one like these"
          actionDisabled={selection.ticked.length === 0}
          actionHint="Tick a few assets first."
          onAction={() => pane.current?.querySelector('textarea')?.focus()}
          onClear={selection.clear}
        />
      )}
      {!selection.selecting && page?.pendingReview && (
        <PendingBanner pending={page.pendingReview} onReview={onReview} />
      )}
      {page && (
        <LibraryToolbar
          counts={page.counts}
          filter={filters.filter}
          onFilterChange={(filter) => onFilterChange({ filter })}
          froms={page.froms}
          from={filters.from}
          onFromChange={(from) => onFilterChange({ from })}
          selecting={selection.selecting}
          onSelectingChange={setSelectingMode}
        />
      )}
      <div className="as-library">
        <LibraryGrid
          items={library.items}
          status={library.status}
          error={library.error}
          search={search}
          selectedId={selection.selectedId}
          onSelect={selection.select}
          selecting={selection.selecting}
          isTicked={selection.isTicked}
          onTick={onTick}
          onClearSearch={() => onFilterChange({ search: '' })}
          onRetry={library.reload}
          onDeleteKey={actions.askDelete}
          hasMore={Boolean(page?.cursor) && library.items.length < (page?.total ?? 0)}
          loadingMore={library.loadingMore}
          onLoadMore={library.loadMore}
        />
        <div ref={pane} className="as-library__pane">
          {makeOpen ? (
            <MakePane
              maker={maker}
              basedOn={selection.ticked}
              onUntick={(asset) => selection.tick(asset, false)}
              onAddPictureMaker={() => navigate('settings', { kind: 'ai' })}
            />
          ) : (
            library.status === 'ready' &&
            library.items.length > 0 && (
              <DetailPane assetId={selection.selectedId} actions={actions} links={links} />
            )
          )}
        </div>
      </div>
      <ContextMenu
        open={links.menu.open}
        anchor={links.menu.anchor}
        items={links.menu.items}
        label={links.menu.label}
        onClose={links.menu.close}
      />
      <ConfirmDialog
        open={actions.pendingDelete !== null}
        title={`Delete ${actions.pendingDelete?.name ?? ''}?`}
        message={`It’s used in ${actions.pendingDelete?.usedInCount ?? 0} lessons. Those lessons keep their own copy.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => void actions.confirmDelete()}
        onCancel={actions.cancelDelete}
      />
    </>
  )
}
