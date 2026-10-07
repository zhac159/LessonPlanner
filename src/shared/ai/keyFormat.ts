/** Shape rules for a pasted Claude API key (design/screens/02-connect-claude.md §5 "Key format errors"). Pure. */
import { fail, ok, type Result } from '../result'

export const KEY_PREFIX = 'sk-ant-'
export const NOT_A_KEY = 'Claude API keys start with sk-ant-.'
export const ADMIN_KEY = 'That’s an Admin key. Create a normal API key instead.'

/**
 * Trims and removes inner whitespace (keys are often pasted with line breaks), then checks the prefix.
 * Failure code is `invalid-input` with the exact in-app message.
 */
export function normaliseApiKey(raw: string): Result<{ key: string }> {
  const key = raw.replace(/\s+/g, '')
  if (key.startsWith(`${KEY_PREFIX}admin`)) return fail('invalid-input', ADMIN_KEY)
  if (!key.startsWith(KEY_PREFIX) || key.length <= KEY_PREFIX.length)
    return fail('invalid-input', NOT_A_KEY)
  return ok({ key })
}

/** The last four characters, the only part of a key that may ever be shown. */
export const lastFourOf = (key: string): string => key.slice(-4)

const KEY_LIKE = /sk-ant-[A-Za-z0-9_-]*/g

/** Replaces anything that looks like a Claude key with `sk-ant-…` so text is safe to log or show. */
export const redactApiKeys = (text: string): string => text.replace(KEY_LIKE, `${KEY_PREFIX}…`)
