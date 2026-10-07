/** Shared fast-xml-parser setup and tiny typed accessors for OOXML (namespace prefixes are stripped). */
import { XMLParser } from 'fast-xml-parser'

export type XmlNode = Record<string, unknown>

/** Tags that can repeat in OOXML; always parsed as arrays so callers never branch on one-vs-many. */
const REPEATING = new Set([
  'sp',
  'pic',
  'grpSp',
  'cxnSp',
  'graphicFrame',
  'p',
  'r',
  'fld',
  'tr',
  'tc',
  'sldId',
  'Relationship'
])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  textNodeName: '#text',
  isArray: (name) => REPEATING.has(name)
})

/** Parses an XML string to a plain object tree; throws on malformed XML. */
export function parseXml(xml: string): XmlNode {
  return parser.parse(xml) as XmlNode
}

const isNode = (value: unknown): value is XmlNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** First child element `key` (an element parsed from an empty tag counts as an empty node). */
export function child(node: XmlNode | undefined, key: string): XmlNode | undefined {
  const value = node?.[key]
  if (isNode(value)) return value
  if (Array.isArray(value)) return isNode(value[0]) ? value[0] : undefined
  return value === '' ? {} : undefined
}

/** All children named `key` as nodes (empty for none). */
export function children(node: XmlNode | undefined, key: string): XmlNode[] {
  const value = node?.[key]
  if (Array.isArray(value)) return value.filter(isNode)
  return isNode(value) ? [value] : []
}

/** Attribute value as string. */
export function attr(node: XmlNode | undefined, name: string): string | undefined {
  const value = node?.[`@_${name}`]
  return typeof value === 'string' ? value : undefined
}

/** Text content of a `<a:t>` style element, which is a string or `{ '#text': … }`. */
export function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (isNode(value) && typeof value['#text'] === 'string') return value['#text']
  return ''
}

/** Path walk: `dig(node, 'cSld', 'spTree')`. */
export function dig(node: XmlNode | undefined, ...keys: string[]): XmlNode | undefined {
  let current = node
  for (const key of keys) current = child(current, key)
  return current
}
