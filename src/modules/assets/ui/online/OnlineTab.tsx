import { Search } from 'lucide-react'
import { OnlineFilters, OnlineSearchBar, SelectionBar } from '@ui/assets'
import { Button, Callout, EmptyState } from '@ui/atoms'
import type { OnlineState } from '../hooks/useOnline'
import { OnlineDetailPane } from './OnlineDetailPane'
import { OnlineResults } from './OnlineResults'

export interface OnlineTabProps {
  online: OnlineState
  /** "Add n to Your assets": opens the review screen for the new batch. */
  onAddChecked(): void
}

/** A9: search row, filters, the dark selection bar, the result cards and the detail pane. */
export function OnlineTab({ online, onAddChecked }: OnlineTabProps) {
  const { status } = online
  const count = online.checked.size
  const searched = online.searched
  return (
    <>
      <OnlineSearchBar
        value={online.query}
        onChange={online.setQuery}
        onSearch={online.search}
        busy={status === 'busy'}
      />
      <OnlineFilters
        freeToUse={online.freeToUse}
        onFreeToUseChange={online.setFreeToUse}
        kind={online.kind}
        onKindChange={online.setKind}
        total={status === 'ready' ? online.total : null}
      />
      {count > 0 && (
        <SelectionBar
          count={count}
          hint="I’ll name them and keep the credits for you"
          actionLabel={`Add ${count} to Your assets`}
          actionLoading={online.adding}
          onAction={onAddChecked}
          onClear={online.clearChecked}
        />
      )}
      {online.providerNote && <Callout variant="soft">{online.providerNote}</Callout>}
      {status === 'idle' && (
        <EmptyState icon={<Search />} title="Search free image libraries">
          Try “volcano diagram” or “cave painting”. Pictures are free to use in lessons unless you
          switch the filter off.
        </EmptyState>
      )}
      {status === 'error' && (
        <Callout
          variant="error"
          action={
            <Button variant="secondary" onClick={online.search}>
              Try again
            </Button>
          }
        >
          {online.error}
        </Callout>
      )}
      {status === 'ready' && online.results.length === 0 && (
        <p className="as-nomatch" role="status">
          {`Nothing found for “${searched}”. Try fewer or simpler words${
            online.freeToUse ? ', or untick Free to use in lessons' : ''
          }.`}
        </p>
      )}
      {(status === 'busy' || (status === 'ready' && online.results.length > 0)) && (
        <div className="as-library as-online">
          <OnlineResults online={online} />
          <div className="as-library__pane">
            {online.selected && status === 'ready' && <OnlineDetailPane online={online} />}
          </div>
        </div>
      )}
    </>
  )
}
