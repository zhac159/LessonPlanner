/** Sortable unique ids (ULID-style: 48-bit time + 80 random bits, Crockford base32). Pure, no deps. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export function ulid(now: number = Date.now()): string {
  let time = ''
  let t = now
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time
    t = Math.floor(t / 32)
  }
  let random = ''
  for (const b of randomBytes(16)) random += ALPHABET[b % 32]
  return time + random.slice(0, 16)
}

/** `newId('sld')` -> `sld_01J...`; the prefix makes ids self-describing in prompts and logs. */
export const newId = (prefix: string): string => `${prefix}_${ulid()}`
