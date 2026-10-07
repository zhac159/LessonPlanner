/** What the SVG sanitiser (svg.ts) lets through: elements, attributes, CSS properties and value checks. */

const list = (text: string): Set<string> => new Set(text.split(/\s+/).filter(Boolean))

export const ALLOWED_ELEMENTS = list(`
  svg g path rect circle ellipse line polyline polygon text tspan textPath defs marker title desc
  linearGradient radialGradient stop clipPath mask pattern symbol use switch
  filter feGaussianBlur feOffset feColorMatrix feBlend feFlood feComposite feMerge feMergeNode feDropShadow
`)

/** Elements whose character data is kept. */
export const TEXT_ELEMENTS = list('text tspan textPath title desc')

/** Dropped without a word: the picture does not need them (editor data) or they are read elsewhere (<style>). */
export const QUIET_ELEMENTS = list('style metadata')

/** Properties that may come from a style attribute or a <style> block; each becomes a presentation attribute. */
export const STYLE_PROPERTIES = list(`
  fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin
  stroke-miterlimit stroke-dasharray stroke-dashoffset opacity font-family font-size font-weight font-style
  text-anchor dominant-baseline letter-spacing marker-start marker-mid marker-end clip-path clip-rule mask
  filter stop-color stop-opacity display visibility color text-decoration mix-blend-mode flood-color
  flood-opacity overflow baseline-shift
`)

export const ALLOWED_ATTRIBUTES = new Set([
  ...STYLE_PROPERTIES,
  ...list(`
    id viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry dx dy width height d points transform
    markerWidth markerHeight markerUnits refX refY orient href xlink:href
    offset gradientUnits gradientTransform spreadMethod fx fy fr patternUnits patternContentUnits
    patternTransform clipPathUnits maskUnits maskContentUnits startOffset
    filterUnits primitiveUnits in in2 result stdDeviation values type mode operator k1 k2 k3 k4
    color-interpolation-filters
  `)
])

/**
 * Dropped things that do not change how the picture looks: editor bookkeeping (Inkscape, Illustrator, XMP),
 * namespace declarations and rendering hints. Everything else that is dropped is reported as `lost`.
 */
const NOISE =
  /^(?:<(?!svg:)[\w.-]*:|@(?!xlink:href)[\w.-]*:|@(?:xmlns|data-|version|baseProfile|enable-background|id$)|<(?:metadata|namedview)>|style:(?:-|enable-background|isolation|pointer-events|cursor|paint-order|shape-rendering|text-rendering|image-rendering|color-interpolation|color-rendering|font-variant|font-feature|font-kerning|line-height|writing-mode|text-align|white-space|word-spacing|direction|unicode-bidi|vector-effect))/i

export const isNoise = (label: string): boolean => NOISE.test(label)

export const LOCAL_URL = /url\(\s*(['"]?)(#[\w.-]+)\1\s*\)/gi

/** True when an attribute value is safe to emit: no scripts, no external `url()`, no CSS escapes. */
export function isSafeValue(name: string, value: string): boolean {
  if (/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) return false
  if (/(?:javascript|vbscript|data)\s*:|expression\s*\(|@import/i.test(value)) return false
  if (/url\(/i.test(value.replace(LOCAL_URL, ''))) return false
  if (name === 'href' || name === 'xlink:href') return /^#[\w.-]+$/.test(value)
  if (name === 'id') return /^[\w.-]+$/.test(value)
  return true
}
