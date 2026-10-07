import { useId, type ReactNode } from 'react'
import { AssetSheet, type AssetSheetProps } from '../AssetSheet/AssetSheet'
import { SegmentedTabs, panelId, tabId, type SegmentedTab } from '../SegmentedTabs/SegmentedTabs'
import './PickerSheet.css'

export type PickerTab = 'assets' | 'online' | 'make'

/** The three tabs of A13, with the exact copy. */
export const PICKER_TABS: readonly SegmentedTab[] = [
  { id: 'assets', label: 'Your assets' },
  { id: 'online', label: 'Find online' },
  { id: 'make', label: 'Make one' }
]

export interface PickerSheetProps extends Omit<AssetSheetProps, 'children' | 'variant'> {
  tab: PickerTab
  onTabChange: (tab: PickerTab) => void
  /** Tabs to offer (default all three); A11 uses none, only A13. */
  tabs?: readonly SegmentedTab[]
  /** The content of the current tab. */
  children: ReactNode
}

/**
 * The A13 shell: an `AssetSheet` with full-width tabs (Your assets · Find online · Make one) above the content of the
 * chosen tab, which is a `tabpanel` labelled by its tab. Each tab's content is the caller's (picker, online search, maker).
 */
export function PickerSheet({
  tab,
  onTabChange,
  tabs = PICKER_TABS,
  children,
  ...sheet
}: PickerSheetProps) {
  const prefix = useId()
  return (
    <AssetSheet {...sheet}>
      <SegmentedTabs
        tabs={tabs}
        value={tab}
        onChange={(id) => onTabChange(id as PickerTab)}
        label="Where to get the picture"
        variant="sheet"
        idPrefix={prefix}
      />
      <div
        role="tabpanel"
        id={panelId(prefix)}
        aria-labelledby={tabId(prefix, tab)}
        className="as-picker-sheet__panel"
      >
        {children}
      </div>
    </AssetSheet>
  )
}
