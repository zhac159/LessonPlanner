/**
 * Strict SVG sanitiser (design/deck-model.md §6) for AI-drawn diagrams and for pictures the teacher adds. Pure
 * string in, string out (no DOM), so it runs in main, renderer and tests alike.
 *
 * Approach: tokenise into a tree, keep only whitelisted elements/attributes, and RE-SERIALISE from the tree.
 * Nothing from the input is ever echoed verbatim, so hostile markup cannot survive by being cleverly
 * encoded. Disallowed elements are dropped with their whole subtree (so `<script>` text never leaks out).
 * Colours that drawing programs keep in CSS (`style`, `class`, `<style>`) are applied to the elements and written
 * back as plain attributes; gradients, clip paths, masks, patterns, filters and same-document `<use>` are kept.
 *
 * Rejected outright (error): not an <svg> document, no/invalid viewBox, over the size cap, DOCTYPE/entity
 * declarations (unless the caller allows them: they are skipped, never expanded), malformed or runaway nesting,
 * a `<use>` that expands to far too many shapes. Everything else unsafe is removed and reported: `removed` lists
 * all of it, `lost` only what may change how the picture looks (editor bookkeeping is left out).
 */

import {
  ALLOWED_ATTRIBUTES,
  ALLOWED_ELEMENTS,
  LOCAL_URL,
  QUIET_ELEMENTS,
  STYLE_PROPERTIES,
  TEXT_ELEMENTS,
  isNoise,
  isSafeValue
} from './svgAllow'
import { cascade, parseStyleSheet, styleText, type Rule } from './svgCss'
import { parseTree, SvgError, type ParseLimits, type SvgNode } from './svgParse'
import { expandsTooMuch } from './svgUse'

export type SvgResult =
  { ok: true; svg: string; removed: string[]; lost: string[] } | { ok: false; error: string }

export const MAX_SVG_BYTES = 200 * 1024
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface SanitiseOptions extends ParseLimits {
  /** Largest input in bytes (default 200 KB, the cap for AI diagrams). */
  maxBytes?: number
  /** Make a viewBox from width and height when there is none (drawing programs often write only those). */
  deriveViewBox?: boolean
}

/** For pictures from drawing programs (Illustrator, Inkscape): bigger, deeper, with a DOCTYPE and no viewBox. */
export const LIBRARY_SVG: SanitiseOptions = {
  maxBytes: 5 * 1024 * 1024,
  maxNodes: 50_000,
  maxDepth: 64,
  allowDoctype: true,
  deriveViewBox: true
}

// ---- sanitising + serialising -----------------------------------------------------------------

const escapeText = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, '&quot;')

interface Ctx {
  rules: readonly Rule[]
  removed: Set<string>
  lost: Set<string>
}

function drop(ctx: Ctx, label: string, quiet = false): void {
  ctx.removed.add(label)
  if (!quiet && !isNoise(label)) ctx.lost.add(label)
}

function validViewBox(value: string): string | null {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  return parts[2] > 0 && parts[3] > 0 ? parts.join(' ') : null
}

const UNIT_PX: Record<string, number> = {
  '': 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96
}

/** A width or height such as `120`, `24pt` or `5cm` in pixels; null for percentages and nonsense. */
function lengthPx(value: string | undefined): number | null {
  const match = /^\s*(\d*\.?\d+)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(value ?? '')
  const px = match ? Number(match[1]) * UNIT_PX[(match[2] ?? '').toLowerCase()] : 0
  return px > 0 && Number.isFinite(px) ? px : null
}

function serialise(node: SvgNode, ctx: Ctx, isRoot: boolean): string {
  const attrs = new Map<string, string>()
  for (const [name, value] of node.attrs) {
    if (name === 'xmlns' || name === 'class' || name === 'style') continue // class/style: see cascade below
    if (!ALLOWED_ATTRIBUTES.has(name) || !isSafeValue(name, value)) {
      drop(ctx, `@${name}`)
      continue
    }
    if (isRoot && name === 'viewBox') continue // re-added on the root below
    // xlink:href needs a namespace declaration that the output does not carry: plain href means the same
    if (name === 'xlink:href' && attrs.has('href')) continue
    attrs.set(name === 'xlink:href' ? 'href' : name, value.replace(LOCAL_URL, 'url($2)'))
  }
  // CSS from `style` and <style> wins over the attributes, like in a browser; what is unsafe is skipped
  for (const { name, value } of cascade(node, ctx.rules)) {
    if (!STYLE_PROPERTIES.has(name) || value.length > 1000) drop(ctx, `style:${name}`)
    else if (!isSafeValue(name, value)) drop(ctx, `style:${name}`)
    else attrs.set(name, value.replace(LOCAL_URL, 'url($2)'))
  }
  const text = TEXT_ELEMENTS.has(node.name)
  let inner = ''
  // <use> draws what it points to; anything written inside it is never drawn
  const children = node.name === 'use' ? [] : node.children
  for (const child of children) {
    if (typeof child === 'string') {
      if (text) inner += escapeText(child)
    } else if (ALLOWED_ELEMENTS.has(child.name)) {
      inner += serialise(child, ctx, false)
    } else {
      // Illustrator's <switch> offers a foreignObject first and the real drawing second
      const spare = node.name === 'switch' && child.name === 'foreignObject'
      drop(ctx, `<${child.name}>`, QUIET_ELEMENTS.has(child.name) || spare)
    }
  }
  const open = [node.name, ...[...attrs].map(([k, v]) => `${k}="${escapeAttr(v)}"`)].join(' ')
  return inner || text ? `<${open}>${inner}</${node.name}>` : `<${open}/>`
}

/**
 * Sanitise an SVG string. On success `svg` is a freshly serialised `<svg xmlns viewBox …>` document that
 * contains only whitelisted elements and attributes; `removed` lists what was dropped and `lost` the part of
 * it that may change how the picture looks. The output is idempotent: sanitising it again returns the same string.
 */
export function sanitiseSvg(input: string, options: SanitiseOptions = {}): SvgResult {
  if (typeof input !== 'string') return { ok: false, error: 'SVG must be a string' }
  const maxBytes = options.maxBytes ?? MAX_SVG_BYTES
  if (new TextEncoder().encode(input).length > maxBytes) {
    return { ok: false, error: `SVG is larger than ${maxBytes / 1024} KB` }
  }
  try {
    const root = parseTree(input, options)
    if (root.name !== 'svg') throw new SvgError('The root element must be <svg>')
    const attr = (name: string): string | undefined => root.attrs.find(([n]) => n === name)?.[1]
    const raw = attr('viewBox')
    let viewBox = raw === undefined ? null : validViewBox(raw)
    if (!viewBox && raw === undefined && options.deriveViewBox) {
      const w = lengthPx(attr('width'))
      const h = lengthPx(attr('height'))
      if (w && h) viewBox = `0 0 ${Math.round(w * 1000) / 1000} ${Math.round(h * 1000) / 1000}`
    }
    if (!viewBox) throw new SvgError('A valid viewBox (four numbers, positive size) is required')
    if (expandsTooMuch(root)) throw new SvgError('A <use> expands into far too many shapes')
    const sheet = parseStyleSheet(styleText(root))
    const ctx: Ctx = { rules: sheet.rules, removed: new Set(), lost: new Set() }
    for (const label of sheet.unsupported) drop(ctx, `css:${label}`)
    const body = serialise(root, ctx, true)
    const svg = body.replace(/^<svg\b/, `<svg xmlns="${SVG_NS}" viewBox="${viewBox}"`)
    return { ok: true, svg, removed: [...ctx.removed], lost: [...ctx.lost] }
  } catch (error) {
    if (error instanceof SvgError) return { ok: false, error: error.message }
    throw error
  }
}

/**
 * Prefix every id (and the `#id` references to them) in an already-sanitised SVG so several diagrams on one
 * page (stage + filmstrip) never share marker ids. Only call this on `sanitiseSvg` output.
 */
export function scopeSvgIds(svg: string, prefix: string): string {
  return svg
    .replace(/\bid="([\w.-]+)"/g, (_, id: string) => `id="${prefix}${id}"`)
    .replace(
      /url\(\s*(['"]?)#([\w.-]+)\1\s*\)/g,
      (_, q: string, id: string) => `url(${q}#${prefix}${id}${q})`
    )
    .replace(
      /\b(xlink:href|href)="#([\w.-]+)"/g,
      (_, attr: string, id: string) => `${attr}="#${prefix}${id}"`
    )
}
