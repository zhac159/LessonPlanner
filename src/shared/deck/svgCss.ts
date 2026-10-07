/**
 * The small slice of CSS the SVG sanitiser understands: `style="a:b"` attributes and `<style>` blocks whose rules
 * use plain selectors (`tag`, `.class`, `#id` and combinations, in comma lists). Illustrator and Inkscape put their
 * colours there. Rules are not copied into the output: they are applied to the elements they match and written
 * back as presentation attributes, so the result carries no `style`, `class` or `<style>` at all.
 */
import type { SvgNode } from './svgParse'

export interface Declaration {
  name: string
  value: string
}

export interface Rule {
  tag?: string
  id?: string
  classes: string[]
  specificity: number
  decls: Declaration[]
}

export interface StyleSheet {
  rules: Rule[]
  /** Selectors, at-rules or declarations that were not understood. */
  unsupported: string[]
}

/** Splits on `separator` outside of parentheses and quotes. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth = Math.max(0, depth - 1)
    else if (c === separator && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

export function parseDeclarations(text: string): Declaration[] {
  const out: Declaration[] = []
  for (const part of splitTop(text, ';')) {
    const at = part.indexOf(':')
    if (at < 1) continue
    const name = part.slice(0, at).trim().toLowerCase()
    const value = part
      .slice(at + 1)
      .replace(/!\s*important\s*$/i, '')
      .trim()
    if (/^-?[a-z][a-z-]*$/.test(name) && value) out.push({ name, value })
  }
  return out
}

const SELECTOR = /^([A-Za-z][\w-]*)?((?:\.[\w-]+)*)(?:#([\w-]+))?$/

export function parseStyleSheet(css: string): StyleSheet {
  const sheet: StyleSheet = { rules: [], unsupported: [] }
  let rest = css.replace(/\/\*[\s\S]*?\*\//g, '')
  while (rest.trim()) {
    const open = rest.indexOf('{')
    const statement = /^\s*(@[\w-]+)[^;{]*;/.exec(rest) // @import, @charset: no block
    if (statement && (open === -1 || statement[0].length < open + 1)) {
      sheet.unsupported.push(statement[1])
      rest = rest.slice(statement[0].length)
      continue
    }
    if (open === -1) break
    const selectorText = rest.slice(0, open).trim()
    let close = open + 1
    for (let depth = 1; close < rest.length && depth > 0; close++) {
      if (rest[close] === '{') depth++
      else if (rest[close] === '}') depth--
    }
    const body = rest.slice(open + 1, close - 1)
    rest = rest.slice(close)
    if (selectorText.startsWith('@')) {
      sheet.unsupported.push(selectorText.split(/\s/)[0] ?? '@rule')
      continue
    }
    const decls = parseDeclarations(body)
    for (const selector of selectorText.split(',').map((s) => s.trim())) {
      const match = SELECTOR.exec(selector)
      if (!selector || !match || !(match[1] || match[2] || match[3])) {
        sheet.unsupported.push(selector || 'selector')
        continue
      }
      const classes = (match[2] ?? '').split('.').filter(Boolean)
      sheet.rules.push({
        tag: match[1],
        id: match[3],
        classes,
        specificity: (match[3] ? 100 : 0) + classes.length * 10 + (match[1] ? 1 : 0),
        decls
      })
    }
  }
  return sheet
}

const attrOf = (node: SvgNode, name: string): string | undefined =>
  node.attrs.find(([n]) => n === name)?.[1]

/**
 * The declarations that apply to an element, in cascade order: matching rules by specificity (then source order),
 * then its own `style` attribute. Later entries of the returned list win.
 */
export function cascade(node: SvgNode, rules: readonly Rule[]): Declaration[] {
  const classes = (attrOf(node, 'class') ?? '').split(/\s+/).filter(Boolean)
  const id = attrOf(node, 'id')
  const matching = rules
    .map((rule, order) => ({ rule, order }))
    .filter(
      ({ rule }) =>
        (!rule.tag || rule.tag === node.name) &&
        (!rule.id || rule.id === id) &&
        rule.classes.every((c) => classes.includes(c))
    )
    .sort((a, b) => a.rule.specificity - b.rule.specificity || a.order - b.order)
  return [
    ...matching.flatMap(({ rule }) => rule.decls),
    ...parseDeclarations(attrOf(node, 'style') ?? '')
  ]
}

/** The text of every `<style>` element (type missing or text/css) below `node`. */
export function styleText(node: SvgNode): string {
  let css = ''
  const type = attrOf(node, 'type')
  if (node.name === 'style' && (!type || type === 'text/css')) {
    css += node.children.filter((c): c is string => typeof c === 'string').join('')
  }
  for (const child of node.children) if (typeof child !== 'string') css += styleText(child)
  return css
}
