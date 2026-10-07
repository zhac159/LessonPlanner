/**
 * Applying a teacher's correction to a StyleProfile (design/style-profile.md §2.5).
 * Two entry points, both validated and both bump `version` and append to `corrections`:
 *  - `applyPatch`: a JSON-Patch subset (add / replace / remove) such as Claude may return;
 *  - `finaliseCorrected`: Claude returned a whole corrected profile; keep the protected fields, validate it.
 */
import { fail, ok, type Result } from '../result'
import { safeParseStyleProfile } from './schema'
import type { StyleProfile } from './types'

export type PatchOp =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string }

/** Top-level fields a correction may never touch: identity, lifecycle and history are owned by the app. */
const PROTECTED = [
  'schemaVersion',
  'id',
  'version',
  'isDefault',
  'status',
  'sources',
  'corrections',
  'createdAt',
  'updatedAt'
]
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_OPS = 100

const decode = (segment: string): string => segment.replace(/~1/g, '/').replace(/~0/g, '~')

/** Splits a JSON Pointer ("/tokens/colors/accent/hex"); returns an error string for unsafe pointers. */
function parsePointer(path: string): string[] | string {
  if (!path.startsWith('/')) return `Bad path "${path}"`
  const segments = path.slice(1).split('/').map(decode)
  if (segments.some((s) => FORBIDDEN_SEGMENTS.has(s))) return `Unsafe path "${path}"`
  if (PROTECTED.includes(segments[0])) return `"${segments[0]}" can’t be changed by a correction`
  return segments
}

type Container = Record<string, unknown> | unknown[]
const isContainer = (value: unknown): value is Container =>
  typeof value === 'object' && value !== null

function arrayIndex(key: string, length: number, allowEnd: boolean): number | null {
  if (allowEnd && key === '-') return length
  if (!/^(0|[1-9]\d*)$/.test(key)) return null
  const index = Number(key)
  return index < length || (allowEnd && index === length) ? index : null
}

/** Applies one op in place on a throwaway clone; returns an error string or null. */
function applyOp(root: Container, op: PatchOp): string | null {
  const segments = parsePointer(op.path)
  if (typeof segments === 'string') return segments
  let parent: unknown = root
  for (const segment of segments.slice(0, -1)) {
    if (!isContainer(parent)) return `Nothing at ${op.path}`
    parent = Array.isArray(parent)
      ? parent[arrayIndex(segment, parent.length, false) ?? -1]
      : parent[segment]
  }
  const last = segments[segments.length - 1]
  if (!isContainer(parent)) return `Nothing at ${op.path}`

  if (Array.isArray(parent)) {
    const index = arrayIndex(last, parent.length, op.op === 'add')
    if (index === null) return `No item at ${op.path}`
    if (op.op === 'add') parent.splice(index, 0, op.value)
    else if (op.op === 'replace') parent[index] = op.value
    else parent.splice(index, 1)
    return null
  }
  const exists = Object.hasOwn(parent, last)
  if (op.op === 'replace' && !exists) return `Nothing to replace at ${op.path}`
  if (op.op === 'remove') {
    if (!exists) return `Nothing to remove at ${op.path}`
    delete parent[last]
  } else {
    parent[last] = op.value
  }
  return null
}

function stamp(before: StyleProfile, after: StyleProfile, text: string, at: string): StyleProfile {
  const version = before.version + 1
  return {
    ...after,
    id: before.id,
    schemaVersion: before.schemaVersion,
    isDefault: before.isDefault,
    status: before.status,
    sources: before.sources,
    createdAt: before.createdAt,
    version,
    updatedAt: at,
    corrections: [...before.corrections, { text, at, appliedInVersion: version }]
  }
}

/**
 * Applies `ops` to a copy of `profile`. Fails (profile untouched) on any bad, unsafe or protected path or when
 * the result no longer is a valid profile. On success `version` is +1 and the correction text is recorded.
 */
export function applyPatch(
  profile: StyleProfile,
  ops: PatchOp[],
  text: string,
  at: string
): Result<{ profile: StyleProfile }> {
  if (ops.length === 0) return fail('invalid-input', 'The correction changed nothing')
  if (ops.length > MAX_OPS) return fail('invalid-input', 'The correction changed too much at once')
  const draft = structuredClone(profile) as unknown as Record<string, unknown>
  for (const op of ops) {
    const error = applyOp(draft, op)
    if (error) return fail('invalid-input', error)
  }
  return validated(profile, draft, text, at)
}

/** Takes a whole corrected profile from Claude: protected fields are restored, the rest must validate. */
export function finaliseCorrected(
  before: StyleProfile,
  corrected: unknown,
  text: string,
  at: string
): Result<{ profile: StyleProfile }> {
  if (!isContainer(corrected) || Array.isArray(corrected)) {
    return fail('invalid-input', 'The corrected style was not a profile')
  }
  return validated(before, corrected, text, at)
}

function validated(
  before: StyleProfile,
  candidate: unknown,
  text: string,
  at: string
): Result<{ profile: StyleProfile }> {
  const parsed = safeParseStyleProfile(candidate)
  if (!parsed.ok) return fail('invalid-input', `The corrected style isn’t valid (${parsed.error})`)
  return ok({ profile: stamp(before, parsed.profile, text, at) })
}
