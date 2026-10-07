/**
 * A tiny JSON Patch (RFC 6902 subset: add / replace / remove) for style corrections. Claude proposes a patch, the
 * app applies it to a COPY and validates the result with the profile schema, so a bad patch never corrupts a style.
 */
export interface PatchOp {
  op: 'add' | 'replace' | 'remove'
  /** JSON Pointer, e.g. `/tokens/colors/accent/hex` or `/habits/-`. */
  path: string
  /** JSON text of the new value (ignored for remove). */
  valueJson: string
}

export class PatchError extends Error {}

const unescape = (segment: string): string => segment.replace(/~1/g, '/').replace(/~0/g, '~')

function split(path: string): string[] {
  if (!path.startsWith('/')) throw new PatchError(`Bad path "${path}"`)
  return path.slice(1).split('/').map(unescape)
}

const isContainer = (value: unknown): value is Record<string, unknown> | unknown[] =>
  typeof value === 'object' && value !== null

function walk(root: unknown, segments: string[]): Record<string, unknown> | unknown[] {
  let current = root
  for (const segment of segments) {
    if (!isContainer(current))
      throw new PatchError('Path goes through a value that is not an object')
    const next: unknown = Array.isArray(current) ? current[Number(segment)] : current[segment]
    if (next === undefined) throw new PatchError(`Nothing at "${segment}"`)
    current = next
  }
  if (!isContainer(current)) throw new PatchError('Parent is not an object or list')
  return current
}

function parseValue(valueJson: string): unknown {
  try {
    return JSON.parse(valueJson)
  } catch {
    throw new PatchError('Value is not valid JSON')
  }
}

function indexOf(list: unknown[], key: string, allowEnd: boolean): number {
  if (key === '-' && allowEnd) return list.length
  const index = Number(key)
  const max = allowEnd ? list.length : list.length - 1
  if (!Number.isInteger(index) || index < 0 || index > max)
    throw new PatchError(`Bad list index "${key}"`)
  return index
}

function applyOne(root: unknown, op: PatchOp): void {
  const segments = split(op.path)
  const key = segments.pop()
  if (key === undefined || key === '') throw new PatchError('Cannot change the whole document')
  const parent = walk(root, segments)
  if (Array.isArray(parent)) {
    if (op.op === 'add') parent.splice(indexOf(parent, key, true), 0, parseValue(op.valueJson))
    else if (op.op === 'replace') parent[indexOf(parent, key, false)] = parseValue(op.valueJson)
    else parent.splice(indexOf(parent, key, false), 1)
    return
  }
  if (op.op === 'add') parent[key] = parseValue(op.valueJson)
  else if (!(key in parent)) throw new PatchError(`Nothing at "${key}"`)
  else if (op.op === 'replace') parent[key] = parseValue(op.valueJson)
  else delete parent[key]
}

/** Applies `ops` in order to a deep copy of `doc`. Throws `PatchError` on anything that does not fit. */
export function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  const copy = structuredClone(doc)
  for (const op of ops) applyOne(copy, op)
  return copy
}
