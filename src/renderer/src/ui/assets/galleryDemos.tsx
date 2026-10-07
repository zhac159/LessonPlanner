/** Small stateful wrappers so the gallery specimens can be tried by hand. */
import { useState } from 'react'
import { filterCounts, type AssetFilterId } from '@shared/assets/library'
import { Button } from '../atoms/Button/Button'
import { AssetCard } from './AssetCard/AssetCard'
import { AssetGrid } from './AssetGrid/AssetGrid'
import { AssetPicker, type PickerMode } from './AssetPicker/AssetPicker'
import { FilterPills } from './FilterPills/FilterPills'
import { FitControl, type FitChoice } from './FitControl/FitControl'
import { BasedOnStrip } from './MakeNew/BasedOnStrip'
import { KeepForm } from './MakeNew/KeepForm'
import { MakeRequestForm } from './MakeNew/MakeRequestForm'
import { MakeNewPanel } from './MakeNew/MakeNewPanel'
import { OnlineFilters } from './OnlineSearch/OnlineFilters'
import { OnlineResultCard } from './OnlineResultCard/OnlineResultCard'
import { OnlineSearchBar } from './OnlineSearch/OnlineSearchBar'
import { PickerSheet, type PickerTab } from './PickerSheet/PickerSheet'
import { SegmentedTabs } from './SegmentedTabs/SegmentedTabs'
import { SelectionBar } from './SelectionBar/SelectionBar'
import { SAMPLE_ASSETS, SAMPLE_RESULTS, SAMPLE_USED, svg } from './galleryData'
import { replaceLabel } from './internal/format'
import type { OnlineKindFilter } from '@shared/contracts/assets'

const noop = (): void => {}

export function CardsDemo({ selectable = false }: { selectable?: boolean }) {
  const [selected, setSelected] = useState(SAMPLE_ASSETS[0]!.id)
  const [checked, setChecked] = useState<string[]>([SAMPLE_ASSETS[3]!.id])
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {selectable && checked.length > 0 && (
        <SelectionBar
          count={checked.length}
          hint="Pick a few that show the look you want"
          actionLabel="Make a new one like these"
          onAction={noop}
          onClear={() => setChecked([])}
        />
      )}
      <AssetGrid
        items={SAMPLE_ASSETS.slice(0, 8)}
        getKey={(a) => a.id}
        label="Your assets"
        renderItem={(a, itemProps) => (
          <AssetCard
            title={a.title}
            name={a.name}
            kind={a.kind}
            usedInCount={SAMPLE_USED[a.name]}
            thumbSrc={a.thumbDataUrl}
            selected={selected === a.id}
            selectable={selectable}
            checked={checked.includes(a.id)}
            onSelect={() => setSelected(a.id)}
            onCheckedChange={(on) =>
              setChecked((now) => (on ? [...now, a.id] : now.filter((id) => id !== a.id)))
            }
            itemProps={itemProps}
          />
        )}
      />
    </div>
  )
}

export function FiltersDemo() {
  const [value, setValue] = useState<AssetFilterId>('all')
  return <FilterPills counts={filterCounts(SAMPLE_ASSETS)} value={value} onChange={setValue} />
}

export function TabsDemo() {
  const [tab, setTab] = useState('mine')
  return (
    <SegmentedTabs
      label="Assets"
      value={tab}
      onChange={setTab}
      tabs={[
        { id: 'mine', label: 'Your assets · 12' },
        { id: 'online', label: 'Find online' }
      ]}
    />
  )
}

export function FitDemo({
  target,
  lowResolution = false
}: {
  target: 'circle' | 'spot'
  lowResolution?: boolean
}) {
  const [fit, setFit] = useState<FitChoice>('fit')
  const [replace, setReplace] = useState(true)
  return (
    <FitControl
      value={fit}
      onChange={setFit}
      target={target}
      lowResolution={lowResolution}
      replace={{
        label: replaceLabel('Photo: leaf in sunlight'),
        checked: replace,
        onChange: setReplace
      }}
    />
  )
}

export function PickerDemo({ mode }: { mode: PickerMode }) {
  const [picked, setPicked] = useState<string[]>([])
  return (
    <div style={{ width: 380 }}>
      <AssetPicker
        mode={mode}
        assets={SAMPLE_ASSETS}
        featured={mode === 'insert' ? undefined : SAMPLE_ASSETS.slice(9, 12)}
        selectedIds={picked}
        onPick={(id) => setPicked([id])}
        onOpenLibrary={noop}
        searchPlaceholder={mode === 'insert' ? undefined : 'Search your assets…'}
      />
    </div>
  )
}

export function SheetDemo() {
  const [tab, setTab] = useState<PickerTab>('assets')
  return (
    <div style={{ width: 400, height: 640 }}>
      <PickerSheet
        title="Fill this picture spot"
        subtitle="“A leaf in sunlight, close up” · slide 3 · 1 of 3"
        tab={tab}
        onTabChange={setTab}
        onBack={noop}
        footer={
          <>
            <Button>Skip</Button>
            <Button variant="primary">Place it · next spot</Button>
          </>
        }
      >
        {tab === 'assets' && <AssetPicker mode="spot" assets={SAMPLE_ASSETS} onPick={noop} />}
        {tab === 'online' && <OnlineDemo compact />}
        {tab === 'make' && <MakeOneDemo />}
      </PickerSheet>
    </div>
  )
}

export function OnlineDemo({ compact = false }: { compact?: boolean }) {
  const [query, setQuery] = useState('volcano diagram')
  const [free, setFree] = useState(true)
  const [kind, setKind] = useState<OnlineKindFilter>('any')
  const [checked, setChecked] = useState<string[]>(['r1', 'r2'])
  const [selected, setSelected] = useState('r1')
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <OnlineSearchBar
        value={query}
        onChange={setQuery}
        onSearch={noop}
        size={compact ? 'md' : 'lg'}
      />
      <OnlineFilters
        freeToUse={free}
        onFreeToUseChange={setFree}
        kind={kind}
        onKindChange={setKind}
        total={compact ? undefined : 48}
        hideKind={compact}
      />
      {!compact && checked.length > 0 && (
        <SelectionBar
          count={checked.length}
          hint="I'll name them and keep the credits for you"
          actionLabel={`Add ${checked.length} to Your assets`}
          onAction={noop}
          onClear={() => setChecked([])}
        />
      )}
      <AssetGrid
        items={SAMPLE_RESULTS}
        getKey={(r) => r.id}
        label="Search results"
        layout="results"
        renderItem={(r, itemProps) => (
          <OnlineResultCard
            title={r.title}
            providerLabel={r.providerLabel}
            licence={r.licence}
            thumbSrc={r.thumbSrc}
            compact={compact}
            checkable={!compact}
            checked={checked.includes(r.id)}
            selected={selected === r.id}
            onSelect={() => setSelected(r.id)}
            onCheckedChange={(on) =>
              setChecked((now) => (on ? [...now, r.id] : now.filter((id) => id !== r.id)))
            }
            itemProps={itemProps}
          />
        )}
      />
    </div>
  )
}

export function MakeDemo() {
  const [prompt, setPrompt] = useState('A Bunsen burner with a lit flame')
  const [versions, setVersions] = useState<2 | 4>(4)
  const [selected, setSelected] = useState<number | null>(3)
  const [name, setName] = useState('bunsen_burner_icon')
  const flame = svg(
    '<path d="M32 8c8 12 8 18 0 26-8-8-8-14 0-26z" fill="#f7d44c"/><rect x="28" y="38" width="8" height="16" fill="#0e7c6b"/>',
    '#fff'
  )
  return (
    <div style={{ width: 380 }}>
      <MakeNewPanel
        basedOn={{
          items: SAMPLE_ASSETS.slice(3, 5)
            .concat(SAMPLE_ASSETS[6]!)
            .map((a) => ({
              id: a.id,
              name: a.name,
              thumbSrc: a.thumbDataUrl
            })),
          onRemove: noop
        }}
        request={{
          prompt,
          onPromptChange: setPrompt,
          versions,
          onVersionsChange: setVersions,
          onMake: noop,
          mode: 'picture-maker',
          perPictureUsd: 0.134
        }}
        versions={{
          versions: [
            { index: 1, state: 'ready', thumbSrc: flame },
            { index: 2, state: 'ready', thumbSrc: flame },
            { index: 3, state: 'ready', thumbSrc: flame },
            { index: 4, state: 'failed' }
          ],
          selected,
          onSelect: setSelected,
          onRetryVersion: noop
        }}
        keep={{ version: selected, name, onNameChange: setName, onKeep: noop, onTryAgain: noop }}
        footnote="Pictures made with Nano Banana Pro carry an invisible Google watermark."
      />
    </div>
  )
}

export function KeepDemo() {
  const [name, setName] = useState('bunsen_burner_icon')
  return (
    <div style={{ width: 340 }}>
      <KeepForm
        version={3}
        verb="Use"
        name={name}
        onNameChange={setName}
        nameError={
          name === 'owl_mascot' ? 'You already have an asset called owl_mascot.' : undefined
        }
        onKeep={noop}
        onTryAgain={noop}
      />
    </div>
  )
}

export function MakeOneDemo() {
  const [prompt, setPrompt] = useState('A leaf in sunlight, close up')
  const [versions, setVersions] = useState<2 | 4>(4)
  return (
    <>
      <BasedOnStrip
        items={SAMPLE_ASSETS.slice(5, 6).map((a) => ({
          id: a.id,
          name: a.name,
          thumbSrc: a.thumbDataUrl
        }))}
        onRemove={noop}
      />
      <MakeRequestForm
        prompt={prompt}
        onPromptChange={setPrompt}
        versions={versions}
        onVersionsChange={setVersions}
        onMake={noop}
        mode="vector"
        onAddPictureMaker={noop}
      />
    </>
  )
}
