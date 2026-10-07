/**
 * Assets kit (alias `@ui/assets`): chips, tiles, cards, pickers, sheets and panels for "Your assets" (agents/ASSETS.md §3.0).
 * Props-driven, no IPC. Pictures arrive as data URLs (`thumbSrc`); copy is the mockups'.
 */
export { AssetCard, type AssetCardProps } from './AssetCard/AssetCard'
export { AssetChip, type AssetChipProps } from './AssetChip/AssetChip'
export { AssetGrid, GRID_WINDOW, type AssetGridProps } from './AssetGrid/AssetGrid'
export {
  AssetPicker,
  type AssetPickerProps,
  type PickerAsset,
  type PickerMode
} from './AssetPicker/AssetPicker'
export { AssetNameTag, type AssetNameTagProps } from './AssetNameTag/AssetNameTag'
export { AssetSheet, type AssetSheetProps } from './AssetSheet/AssetSheet'
export { AssetTile, type AssetTileProps } from './AssetTile/AssetTile'
export { FilterPills, type FilterPillsProps } from './FilterPills/FilterPills'
export {
  FIT_WORDING,
  FitControl,
  FitFillToggle,
  type FitChoice,
  type FitControlProps
} from './FitControl/FitControl'
export {
  LicenceBadge,
  licenceTone,
  type LicenceBadgeProps,
  type LicenceTone
} from './LicenceBadge/LicenceBadge'
export { OnlineResultCard, type OnlineResultCardProps } from './OnlineResultCard/OnlineResultCard'
export {
  PICKER_TABS,
  PickerSheet,
  type PickerSheetProps,
  type PickerTab
} from './PickerSheet/PickerSheet'
export { PictureSpotBadge, type PictureSpotBadgeProps } from './PictureSpotBadge/PictureSpotBadge'
export { RegionActionBar, type RegionActionBarProps } from './RegionActionBar/RegionActionBar'
export {
  SegmentedTabs,
  panelId,
  tabId,
  type SegmentedTab,
  type SegmentedTabsProps
} from './SegmentedTabs/SegmentedTabs'
export { SelectionBar, type SelectionBarProps } from './SelectionBar/SelectionBar'
export { SpotMark, type SpotMarkProps } from './SpotMark/SpotMark'
export { SpotsCard, type SpotsCardProps } from './SpotsCard/SpotsCard'

// A1 detail pane and its parts
export {
  AssetDetailPanel,
  DESCRIPTION_MAX,
  type AssetDetailPanelProps
} from './AssetDetail/AssetDetailPanel'
export { AssetFacts, type AssetFactsProps } from './AssetDetail/AssetFacts'
export { ChatNameField, type ChatNameFieldProps } from './AssetDetail/ChatNameField'
export { EditableTitle, TITLE_MAX, type EditableTitleProps } from './AssetDetail/EditableTitle'
export {
  CreditLine,
  PROVIDER_LABELS,
  SourceLine,
  type CreditLineProps,
  type SourceLineProps
} from './AssetDetail/SourceInfo'
export { TagEditor, type TagEditorProps } from './AssetDetail/TagEditor'
export { MAX_TAGS, MAX_TAG_LENGTH, addTag, normaliseTag, removeTag } from './AssetDetail/tags'

// A2 review
export {
  ReviewFileRow,
  ReviewMoreRow,
  type ReviewFileRowProps,
  type ReviewMoreRowProps
} from './Review/ReviewFileRow'
export { ReviewFilter, type ReviewFilterProps, type ReviewView } from './Review/ReviewFilter'
export { ReviewRow, type ReviewRowProps } from './Review/ReviewRow'

// A8 make a new one (and A13 "Make one")
export { BasedOnStrip, type BasedOnItem, type BasedOnStripProps } from './MakeNew/BasedOnStrip'
export { KeepForm, type KeepFormProps } from './MakeNew/KeepForm'
export { MakeNewPanel, type MakeNewPanelProps } from './MakeNew/MakeNewPanel'
export { MakeRequestForm, type MakeRequestFormProps } from './MakeNew/MakeRequestForm'
export { VersionPicker, type VersionPickerProps, type VersionView } from './MakeNew/VersionPicker'

// A9 find online
export {
  ONLINE_KIND_OPTIONS,
  OnlineFilters,
  type OnlineFiltersProps
} from './OnlineSearch/OnlineFilters'
export { OnlineDetail, licenceNotice, type OnlineDetailProps } from './OnlineSearch/OnlineDetail'
export { OnlineSearchBar, type OnlineSearchBarProps } from './OnlineSearch/OnlineSearchBar'

// shared pieces and wording
export { KindPill, type KindPillProps } from './internal/KindPill'
export { Thumb, type ThumbProps } from './internal/Thumb'
export {
  costLine,
  decksLabel,
  foundCountLabel,
  foundInText,
  foundSummary,
  keepLabel,
  leftOutLabel,
  replaceLabel,
  spotsLabel,
  truncate
} from './internal/format'
export { useRovingGrid, type RovingItemProps } from './internal/useRovingGrid'
