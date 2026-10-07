/**
 * `<use>` copies another part of the drawing, so a few hundred bytes can ask a renderer for billions of shapes
 * (each level of a chain uses the one below twice). This counts what the references would expand to, without
 * expanding anything, and says when it is too much.
 */
import type { SvgNode } from './svgParse'

/** More shapes than any real drawing needs once every `<use>` is counted. */
export const MAX_EXPANDED_NODES = 200_000

const hrefOf = (node: SvgNode): string | undefined =>
  node.attrs.find(([n]) => n === 'href' || n === 'xlink:href')?.[1]

/** True when the drawing expands (through `<use>`) to more than `limit` elements. */
export function expandsTooMuch(root: SvgNode, limit = MAX_EXPANDED_NODES): boolean {
  const byId = new Map<string, SvgNode>()
  const index = (node: SvgNode): void => {
    const id = node.attrs.find(([n]) => n === 'id')?.[1]
    if (id && !byId.has(id)) byId.set(id, node)
    for (const child of node.children) if (typeof child !== 'string') index(child)
  }
  index(root)

  const weights = new Map<SvgNode, number>()
  const active = new Set<SvgNode>()
  const weigh = (node: SvgNode): number => {
    const known = weights.get(node)
    if (known !== undefined) return known
    if (active.has(node)) return 0 // a use inside what it uses: renderers stop there
    active.add(node)
    let total = 1
    for (const child of node.children) if (typeof child !== 'string') total += weigh(child)
    if (node.name === 'use') {
      const target = /^#([\w.-]+)$/.exec(hrefOf(node) ?? '')?.[1]
      const used = target ? byId.get(target) : undefined
      if (used) total += weigh(used)
    }
    active.delete(node)
    total = Math.min(total, limit + 1)
    weights.set(node, total)
    return total
  }
  try {
    return weigh(root) > limit
  } catch (error) {
    if (error instanceof RangeError) return true // a chain of references too long to follow
    throw error
  }
}
