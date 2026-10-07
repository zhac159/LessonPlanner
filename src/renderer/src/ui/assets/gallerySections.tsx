/** Gallery specimens for the library, picker and spot components. */
import type { ReactNode } from 'react'
import { LICENCES } from '@shared/assets/credits'
import { filterCounts } from '@shared/assets/library'
import type { GallerySection } from '@ui/gallery'
import { Button } from '../atoms/Button/Button'
import { AssetCard } from './AssetCard/AssetCard'
import { AssetChip } from './AssetChip/AssetChip'
import { AssetNameTag } from './AssetNameTag/AssetNameTag'
import { AssetPicker } from './AssetPicker/AssetPicker'
import { AssetSheet } from './AssetSheet/AssetSheet'
import { AssetTile } from './AssetTile/AssetTile'
import { FilterPills } from './FilterPills/FilterPills'
import { LicenceBadge } from './LicenceBadge/LicenceBadge'
import { PictureSpotBadge } from './PictureSpotBadge/PictureSpotBadge'
import { RegionActionBar } from './RegionActionBar/RegionActionBar'
import { SelectionBar } from './SelectionBar/SelectionBar'
import { SpotMark } from './SpotMark/SpotMark'
import { SpotsCard } from './SpotsCard/SpotsCard'
import { CardsDemo, FiltersDemo, FitDemo, PickerDemo, SheetDemo, TabsDemo } from './galleryDemos'
import { SAMPLE_ASSETS } from './galleryData'

const noop = (): void => {}
const row = (children: ReactNode) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</div>
)
const [logo, banner, owl, beaker] = SAMPLE_ASSETS

export const librarySections: GallerySection[] = [
  {
    name: 'AssetChip · inline, composer, removed (hover or focus for the popover)',
    render: () =>
      row(
        <>
          <AssetChip
            name="school_logo"
            title="School logo"
            kind="logo"
            thumbSrc={logo!.thumbDataUrl}
          />
          <AssetChip
            name="owl_mascot"
            title="Owl mascot"
            kind="character"
            thumbSrc={owl!.thumbDataUrl}
            variant="composer"
            onRemove={noop}
          />
          <AssetChip name="old_logo" variant="removed" />
        </>
      )
  },
  {
    name: 'AssetTile · normal, selected, long name',
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 110px)', gap: 8 }}>
        <AssetTile name="school_logo" thumbSrc={logo!.thumbDataUrl} />
        <AssetTile name="do_now_banner" thumbSrc={banner!.thumbDataUrl} selected />
        <AssetTile name="plant_cell_diagram" thumbSrc={SAMPLE_ASSETS[9]!.thumbDataUrl} />
      </div>
    )
  },
  {
    name: 'AssetCard · normal, selected, selectable, ticked, no thumbnail yet',
    render: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 176px)', gap: 16 }}>
        <AssetCard
          title="School logo"
          name="school_logo"
          kind="logo"
          usedInCount={14}
          thumbSrc={logo!.thumbDataUrl}
        />
        <AssetCard
          title="Do Now banner"
          name="do_now_banner"
          kind="banner"
          usedInCount={1}
          thumbSrc={banner!.thumbDataUrl}
          selected
        />
        <AssetCard
          title="Owl mascot"
          name="owl_mascot"
          kind="character"
          usedInCount={0}
          thumbSrc={owl!.thumbDataUrl}
          selectable
        />
        <AssetCard
          title="Beaker"
          name="beaker_icon"
          kind="icon"
          usedInCount={11}
          thumbSrc={beaker!.thumbDataUrl}
          selectable
          checked
        />
        <AssetCard
          title="New picture"
          name="new_picture"
          kind="picture"
          usedInCount={0}
          thumbSrc={null}
        />
      </div>
    )
  },
  {
    name: 'AssetGrid · arrow keys, Enter selects (try it); selection mode with SelectionBar',
    render: () => (
      <div style={{ display: 'grid', gap: 24 }}>
        <CardsDemo />
        <CardsDemo selectable />
      </div>
    )
  },
  {
    name: 'FilterPills · All with count, scrolling in a narrow sheet',
    render: () => (
      <div style={{ display: 'grid', gap: 16 }}>
        <FiltersDemo />
        <div style={{ width: 300 }}>
          <FilterPills
            counts={filterCounts(SAMPLE_ASSETS)}
            value="icons"
            onChange={noop}
            showCount={false}
            scroll
          />
        </div>
      </div>
    )
  },
  {
    name: 'SelectionBar · dark bar with Clear and the action',
    render: () => (
      <div style={{ display: 'grid', gap: 12 }}>
        <SelectionBar
          count={3}
          hint="Pick a few that show the look you want"
          actionLabel="Make a new one like these"
          onAction={noop}
          onClear={noop}
        />
        <SelectionBar
          count={1}
          actionLabel="Add 1 to Your assets"
          onAction={noop}
          onClear={noop}
          actionDisabled
          actionHint="Name it first"
        />
      </div>
    )
  },
  {
    name: 'LicenceBadge · green, blue, amber, neutral',
    render: () =>
      row(
        <>
          {(
            [
              'cc0',
              'public-domain',
              'cc-by',
              'cc-by-sa',
              'cc-by-nc',
              'cc-by-nd',
              'other',
              'own',
              'generated'
            ] as const
          ).map((id) => (
            <LicenceBadge key={id} licence={LICENCES[id]} />
          ))}
          <LicenceBadge licence={LICENCES['cc-by-nc']} exact />
        </>
      )
  },
  {
    name: 'FitControl · circle, spot, small picture',
    render: () => (
      <div style={{ display: 'grid', gap: 24, width: 420 }}>
        <FitDemo target="circle" />
        <FitDemo target="spot" />
        <FitDemo target="circle" lowResolution />
      </div>
    )
  },
  {
    name: 'AssetSheet · band (A11), card (A4)',
    render: () => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ width: 380, height: 300 }}>
          <AssetSheet
            title="Add to region 1"
            subtitle="Pick an asset. I'll scale it to fit your circle."
            badge="1"
            onBack={noop}
            footer={
              <>
                <Button>Cancel</Button>
                <Button variant="primary">Place it</Button>
              </>
            }
          >
            <p>Body scrolls; the footer stays.</p>
          </AssetSheet>
        </div>
        <div style={{ width: 380 }}>
          <AssetSheet title="Add an asset" variant="card" onBack={noop} onClose={noop}>
            <p>A card above the Composer.</p>
          </AssetSheet>
        </div>
      </div>
    )
  },
  { name: 'SegmentedTabs · Your assets · 12, Find online', render: () => <TabsDemo /> },
  { name: 'PickerSheet · Your assets, Find online, Make one', render: () => <SheetDemo /> },
  {
    name: 'AssetPicker · insert (A4), place (A11), spot (A13)',
    render: () => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'start' }}>
        <PickerDemo mode="insert" />
        <PickerDemo mode="place" />
        <PickerDemo mode="spot" />
      </div>
    )
  },
  {
    name: 'AssetPicker · empty library',
    render: () => (
      <div style={{ width: 380 }}>
        <AssetPicker
          mode="insert"
          assets={[]}
          onPick={noop}
          onOpenLibrary={noop}
          onFindOnline={noop}
        />
      </div>
    )
  },
  {
    name: 'SpotMark · full, selected, faint (thumbnail)',
    render: () =>
      row(
        <>
          <div style={{ width: 300, height: 220 }}>
            <SpotMark description="A leaf in sunlight, close up" onFill={noop} />
          </div>
          <div style={{ width: 300, height: 220 }}>
            <SpotMark description="A leaf in sunlight, close up" onFill={noop} selected />
          </div>
          <div style={{ width: 120, height: 80 }}>
            <SpotMark description="A leaf" variant="faint" />
          </div>
        </>
      )
  },
  {
    name: 'SpotsCard · 3 spots, 1 spot, all filled',
    render: () => (
      <div style={{ display: 'grid', gap: 12, width: 360 }}>
        <SpotsCard count={3} onFillFirst={noop} />
        <SpotsCard count={1} onFillFirst={noop} />
        <SpotsCard count={0} onFillFirst={noop} />
      </div>
    )
  },
  {
    name: 'PictureSpotBadge · filmstrip',
    render: () =>
      row(
        <>
          <PictureSpotBadge slideNumber={3} count={1} onClick={noop} />
          <PictureSpotBadge slideNumber={5} count={2} onClick={noop} />
        </>
      )
  },
  {
    name: 'RegionActionBar · Add asset here, Ask Claude, ×',
    render: () => (
      <div style={{ position: 'relative', height: 70 }}>
        <RegionActionBar
          regionNumber={1}
          onAddAsset={noop}
          onAskClaude={noop}
          onDismiss={noop}
          style={{ left: 0, top: 8 }}
        />
      </div>
    )
  },
  {
    name: 'AssetNameTag · placed name, fitted preview',
    render: () =>
      row(
        <>
          <AssetNameTag>school_logo</AssetNameTag>
          <AssetNameTag>leaf_cross_section · fitted to region 1</AssetNameTag>
        </>
      )
  }
]
