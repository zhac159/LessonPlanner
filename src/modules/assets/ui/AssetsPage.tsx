import { Globe, Image as ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { SegmentedTabs, panelId, tabId } from '@ui/assets'
import { useAssetActions } from './hooks/useAssetActions'
import { useLibrary, type LibraryFilters } from './hooks/useLibrary'
import { useOnline } from './hooks/useOnline'
import { useTidiedToast } from './hooks/useTidiedToast'
import { LibraryHeader } from './library/LibraryHeader'
import { LibraryTab } from './library/LibraryTab'
import type { AssetsRoute, AssetsTab } from './model/route'
import { OnlineTab } from './online/OnlineTab'

export interface AssetsPageProps {
  route: Extract<AssetsRoute, { screen: 'page' }>
  active: boolean
  /** Opens A2 (for a batch, or for everything waiting). */
  onReview(batchId?: string): void
}

const isTyping = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  return Boolean(el?.matches?.('input, textarea, select, [contenteditable="true"]'))
}

const hasFiles = (event: DragEvent): boolean =>
  Array.from(event.dataTransfer?.types ?? []).includes('Files')

/** The page of A1, A8 and A9: header, the two tabs and what each shows. Drops anywhere add files. */
export function AssetsPage({ route, active, onReview }: AssetsPageProps) {
  const [tab, setTab] = useState<AssetsTab>(route.tab)
  const [filters, setFilters] = useState<LibraryFilters>({
    search: '',
    filter: 'all',
    from: 'anywhere'
  })
  const search = useRef<HTMLInputElement>(null)
  const library = useLibrary(filters, active)
  const actions = useAssetActions(onReview)
  const online = useOnline(route.onlineQuery)
  useTidiedToast(active)

  const showLibrary = (): void => setTab('library')

  // "/" jumps to the search field.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTyping(event.target)) return
      event.preventDefault()
      setTab('library')
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const tabs = useMemo(
    () => [
      {
        id: 'library',
        label: `Your assets · ${library.page?.libraryCount ?? 0}`,
        icon: <ImageIcon />
      },
      { id: 'online', label: 'Find online', icon: <Globe /> }
    ],
    [library.page?.libraryCount]
  )

  const onDrop = (event: DragEvent): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    void actions.drop(Array.from(event.dataTransfer.files))
  }

  return (
    <div
      className="as-page"
      onDragOver={(event) => hasFiles(event) && event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="as-page__main">
        <LibraryHeader
          search={filters.search}
          searchRef={search}
          onSearchChange={(value) => {
            showLibrary()
            setFilters((current) => ({ ...current, search: value }))
          }}
          onUpload={() => void actions.pick()}
          uploading={actions.adding}
        />
        <SegmentedTabs
          tabs={tabs}
          value={tab}
          onChange={(id) => setTab(id as AssetsTab)}
          label="Assets"
          idPrefix="as"
        />
        <div
          role="tabpanel"
          id={panelId('as')}
          aria-labelledby={tabId('as', tab)}
          className="as-page__panel"
        >
          {tab === 'library' ? (
            <LibraryTab
              library={library}
              filters={filters}
              onFilterChange={(next) => setFilters((current) => ({ ...current, ...next }))}
              active={active}
              basedOnIds={route.basedOn}
              actions={actions}
              onReview={() => onReview()}
              onFindOnline={() => setTab('online')}
            />
          ) : (
            <OnlineTab
              online={online}
              onAddChecked={() => void online.addChecked().then((id) => id && onReview(id))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
