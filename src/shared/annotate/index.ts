/** Circle to edit, pure part: path simplification, geometry, hit-testing and the text Claude reads. */
export type { Box, Point, Region } from './types'
export { RDP_TOLERANCE, cleanPath, simplifyPath } from './simplify'
export {
  CROP_PADDING,
  MIN_CROP_SIZE,
  MIN_LOOP_LENGTH,
  MIN_LOOP_SIZE,
  boxArea,
  clampToSlide,
  isTinyLoop,
  paddedCropBox,
  pathLength,
  polygonArea,
  polygonBoundingBox,
  ring
} from './geometry'
export {
  CONTAINED_THRESHOLD,
  COVERAGE_THRESHOLD,
  isTargeted,
  overlapOf,
  overlapRatio,
  targetElementIds,
  targetElements,
  type Overlap
} from './overlap'
export { describeElement, describeRegion } from './describe'
export {
  MAX_RENDER_PIXELS,
  MAX_RENDER_SCALE,
  MIN_RENDER_SCALE,
  isRenderJob,
  jobPixelSize,
  type RenderBridge,
  type RenderJob,
  type RenderRegion,
  type RenderReport
} from './renderJob'
