/**
 * Minimal, strict XML tokeniser for the SVG sanitiser (svg.ts): no DOM, no entity declarations, bounded size.
 * Produces a plain tree; it makes NO safety decisions (the sanitiser whitelists afterwards).
 */

const MAX_NODES = 5000
const MAX_DEPTH = 24

export interface ParseLimits {
  maxNodes?: number
  maxDepth?: number
  /** Skip a DOCTYPE (and its entity declarations) instead of refusing it. Entities are never expanded. */
  allowDoctype?: boolean
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  deg: '°',
  middot: '·',
  times: '×',
  divide: '÷',
  minus: '−',
  plusmn: '±',
  rarr: '→',
  larr: '←',
  ndash: '–',
  mdash: '—',
  hellip: '…'
}

export interface SvgNode {
  name: string
  attrs: Array<[string, string]>
  children: Array<SvgNode | string>
}

export class SvgError extends Error {}

// ---- tokenising -------------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      const control = code < 0x20 && code !== 9 && code !== 10 && code !== 13
      return control || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
        ? ''
        : String.fromCodePoint(code)
    }
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

const NAME_RE = /[A-Za-z_][\w:.-]*/y
const ATTR_NAME_RE = /[^\s=/>"'<]+/y

/** Reads `<name attr="v" ...>` starting at `start`. Returns the node, whether it self-closes, and the end index. */
function readOpenTag(
  src: string,
  start: number
): { node: SvgNode; selfClosing: boolean; end: number } {
  NAME_RE.lastIndex = start + 1
  const nameMatch = NAME_RE.exec(src)
  if (!nameMatch) throw new SvgError('Malformed tag')
  const node: SvgNode = { name: nameMatch[0], attrs: [], children: [] }
  let i = NAME_RE.lastIndex
  for (;;) {
    while (i < src.length && /\s/.test(src[i])) i++
    if (i >= src.length) throw new SvgError('Unterminated tag')
    if (src[i] === '>') return { node, selfClosing: false, end: i + 1 }
    if (src[i] === '/' && src[i + 1] === '>') return { node, selfClosing: true, end: i + 2 }
    ATTR_NAME_RE.lastIndex = i
    const attr = ATTR_NAME_RE.exec(src)
    if (!attr) throw new SvgError('Malformed attribute')
    i = ATTR_NAME_RE.lastIndex
    while (i < src.length && /\s/.test(src[i])) i++
    let value = ''
    if (src[i] === '=') {
      i++
      while (i < src.length && /\s/.test(src[i])) i++
      const quote = src[i]
      if (quote !== '"' && quote !== "'") throw new SvgError('Attribute values must be quoted')
      const close = src.indexOf(quote, i + 1)
      if (close === -1) throw new SvgError('Unterminated attribute value')
      value = decodeEntities(src.slice(i + 1, close))
      i = close + 1
    }
    node.attrs.push([attr[0], value])
  }
}

/** Index just after a `<!DOCTYPE ...>` that starts at `start`, walking over quotes and an [internal subset]. */
function doctypeEnd(src: string, start: number): number {
  let depth = 0
  let quote = ''
  for (let i = start + 2; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '[') depth++
    else if (c === ']') depth = Math.max(0, depth - 1)
    else if (c === '>' && depth === 0) return i + 1
  }
  throw new SvgError('Unterminated DOCTYPE')
}

export function parseTree(src: string, limits: ParseLimits = {}): SvgNode {
  const maxNodes = limits.maxNodes ?? MAX_NODES
  const maxDepth = limits.maxDepth ?? MAX_DEPTH
  const stack: SvgNode[] = []
  let root: SvgNode | null = null
  let count = 0
  let i = 0
  const addText = (text: string): void => {
    if (stack.length) stack[stack.length - 1].children.push(text)
    else if (text.trim()) throw new SvgError('Text outside the <svg> element')
  }
  while (i < src.length) {
    if (src[i] !== '<') {
      const next = src.indexOf('<', i)
      const end = next === -1 ? src.length : next
      addText(decodeEntities(src.slice(i, end)))
      i = end
    } else if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4)
      if (end === -1) throw new SvgError('Unterminated comment')
      i = end + 3
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i)
      if (end === -1) throw new SvgError('Unterminated CDATA section')
      addText(src.slice(i + 9, end))
      i = end + 3
    } else if (limits.allowDoctype && !root && /^<!DOCTYPE\s/i.test(src.slice(i, i + 10))) {
      i = doctypeEnd(src, i)
    } else if (src.startsWith('<!', i)) {
      throw new SvgError('DOCTYPE and entity declarations are not allowed')
    } else if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i)
      if (end === -1) throw new SvgError('Unterminated processing instruction')
      i = end + 2
    } else if (src.startsWith('</', i)) {
      const end = src.indexOf('>', i)
      if (end === -1) throw new SvgError('Unterminated closing tag')
      const name = src.slice(i + 2, end).trim()
      if (stack.pop()?.name !== name) throw new SvgError(`Mismatched closing tag </${name}>`)
      i = end + 1
    } else {
      const { node, selfClosing, end } = readOpenTag(src, i)
      if (++count > maxNodes) throw new SvgError('Too many elements')
      if (stack.length) stack[stack.length - 1].children.push(node)
      else if (root) throw new SvgError('Only one root element is allowed')
      else root = node
      if (!selfClosing) {
        stack.push(node)
        if (stack.length > maxDepth) throw new SvgError('Elements are nested too deeply')
      }
      i = end
    }
  }
  if (stack.length) throw new SvgError('Unclosed element')
  if (!root) throw new SvgError('No <svg> element found')
  return root
}
