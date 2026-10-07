/** Editor tools: the tool rail and the circle-to-edit annotation layer. Import from '@ui/editor'. */
export { ToolButton, type ToolButtonProps } from './ToolButton/ToolButton'
export { ToolRail, type ToolRailProps } from './ToolRail/ToolRail'
export { shortcutFor, isTextEntry, type ShortcutAction } from './ToolRail/shortcuts'
export {
  CANVAS_TOOLS,
  HISTORY_ACTIONS,
  type EditorAction,
  type EditorTool,
  type ToolDefinition
} from './ToolRail/tools'
export { RegionLabel, type RegionLabelProps } from './RegionLabel/RegionLabel'
export {
  RegionOverlay,
  type OverlayRegion,
  type RegionOverlayProps
} from './RegionOverlay/RegionOverlay'
export { boundsOf, clientToSlide, labelPlacement, type Bounds } from './RegionOverlay/geometry'
