/**
 * Chat names of assets (`{{school_logo}}`): the rules, the slug helper and the "is this name free" check.
 * Pure. The rules are in agents/ASSETS.md §2.2; the same functions run in the renderer (live check while
 * typing) and in main (the check that counts).
 */

export const ASSET_NAME_MIN = 2
export const ASSET_NAME_MAX = 32

/** lower-case letters and digits in words joined by single underscores, at least one letter. */
export const ASSET_NAME_RE = /^(?=.*[a-z])[a-z0-9]+(?:_[a-z0-9]+)*$/

/** Words the chat or the editor already uses, so `{{slide}}` or `{{region_1}}` can never mean an asset. */
export const RESERVED_ASSET_NAMES: readonly string[] = [
  'all',
  'asset',
  'assets',
  'here',
  'library',
  'new',
  'none',
  'open',
  'picture_spot',
  'region',
  'selected',
  'slide',
  'slides',
  'spot',
  'this',
  'undo',
  'redo'
]

const RESERVED_PATTERN = /^(?:slide|region|spot|picture_spot)_?\d+$/

export const isReservedAssetName = (name: string): boolean =>
  RESERVED_ASSET_NAMES.includes(name) || RESERVED_PATTERN.test(name)

export type NameProblem = 'too-short' | 'too-long' | 'invalid' | 'reserved' | 'taken'

export type NameCheck =
  { ok: true; name: string } | { ok: false; problem: NameProblem; message: string }

/** Exact copy shown under the "Name in chat" field (agents/ASSETS.md §3.1 (A1)). */
export const NAME_MESSAGES: Readonly<Record<NameProblem, (name: string) => string>> = {
  'too-short': () => `Use at least ${ASSET_NAME_MIN} characters.`,
  'too-long': () => `Use ${ASSET_NAME_MAX} characters or fewer.`,
  invalid: () => 'Use letters, numbers and underscores, with at least one letter.',
  reserved: (name) => `“${name}” is kept for the app. Try another name.`,
  taken: (name) => `You already have an asset called ${name}.`
}

/**
 * Turns anything typed into a candidate name: accents removed, lower-case, every run of other characters
 * becomes one underscore, no leading or trailing underscore. `{{school logo}}` -> `school_logo`.
 * `maxLength` cuts at a word boundary when one is close enough (default: no cut).
 */
export function slugifyAssetName(input: string, maxLength: number = Infinity): string {
  let slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength)
    const cut = slug.lastIndexOf('_')
    if (cut >= Math.floor(maxLength * 0.6)) slug = slug.slice(0, cut)
    slug = slug.replace(/_+$/g, '')
  }
  return slug
}

const lowerSet = (taken: Iterable<string>): Set<string> => {
  const out = new Set<string>()
  for (const name of taken) out.add(name.toLowerCase())
  return out
}

/**
 * Validates a typed name against the rules and the names already in use. `ownName` is the asset's current
 * name when renaming (keeping it is fine). On success `name` is the normalised form to store.
 */
export function checkAssetName(
  input: string,
  taken: Iterable<string>,
  ownName?: string
): NameCheck {
  const name = slugifyAssetName(input)
  const fail = (problem: NameProblem): NameCheck => ({
    ok: false,
    problem,
    message: NAME_MESSAGES[problem](name || input.trim())
  })
  if (name.length === 0 || !/[a-z]/.test(name))
    return fail(name.length === 0 ? 'too-short' : 'invalid')
  if (name.length < ASSET_NAME_MIN) return fail('too-short')
  if (name.length > ASSET_NAME_MAX) return fail('too-long')
  if (isReservedAssetName(name)) return fail('reserved')
  const used = lowerSet(taken)
  if (ownName) used.delete(ownName.toLowerCase())
  if (used.has(name)) return fail('taken')
  return { ok: true, name }
}

/** `base`, or `base_2`, `base_3`… (cut so it still fits 32 characters) until it is free and allowed. */
export function uniqueAssetName(base: string, taken: Iterable<string>): string {
  const used = lowerSet(taken)
  let root = slugifyAssetName(base, ASSET_NAME_MAX) || 'image'
  // A reserved word (and its numbered forms) can never be a name: 'slide' becomes 'slide_image'.
  if (isReservedAssetName(root)) root = slugifyAssetName(`${root}_image`, ASSET_NAME_MAX)
  const ok = (name: string): boolean =>
    name.length >= ASSET_NAME_MIN && !used.has(name) && !isReservedAssetName(name)
  if (ok(root)) return root
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `_${n}`
    const candidate = `${root.slice(0, ASSET_NAME_MAX - suffix.length).replace(/_+$/g, '')}${suffix}`
    if (ok(candidate)) return candidate
  }
  return `${root.slice(0, ASSET_NAME_MAX - 5)}_${Date.now() % 10_000}`
}

/** A first name for a picture from the words Claude (or the source site) gave it. */
export const suggestAssetName = (title: string, taken: Iterable<string>): string =>
  uniqueAssetName(title, taken)
