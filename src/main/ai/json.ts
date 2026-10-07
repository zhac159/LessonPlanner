/** JSON helpers for prompts and streaming: stable serialisation (cache-friendly) and tolerant partial parsing. */

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeys(record[key])])
    )
  }
  return value
}

/**
 * Compact JSON with object keys sorted at every depth, so equal data always renders to identical text.
 * Prompt-cache prefixes depend on byte-for-byte equality (design/ai-pipeline.md §3).
 */
export const stableStringify = (value: unknown): string => JSON.stringify(sortKeys(value))

interface Scan {
  /** Closing brackets still owed at the end of the scanned text, innermost last. */
  closers: string[]
  inString: boolean
  /** Positions of commas outside strings, with the closers owed at that point. */
  commas: Array<{ at: number; closers: string }>
}

function scan(text: string): Scan {
  const closers: string[] = []
  const commas: Scan['commas'] = []
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') closers.push('}')
    else if (ch === '[') closers.push(']')
    else if (ch === '}' || ch === ']') closers.pop()
    else if (ch === ',') commas.push({ at: i, closers: [...closers].reverse().join('') })
  }
  return { closers, inString, commas }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Parses JSON that may be cut off mid-way (a streaming structured output). Closes open strings and brackets;
 * if the tail is unusable (half a number, a key without a value) it drops back to the last complete item.
 * Returns `undefined` when nothing usable has arrived yet.
 */
export function parsePartialJson(text: string): unknown {
  const whole = tryParse(text)
  if (whole !== undefined) return whole
  const { closers, inString, commas } = scan(text)
  const closed = text + (inString ? '"' : '') + [...closers].reverse().join('')
  const direct = tryParse(closed)
  if (direct !== undefined) return direct
  for (let i = commas.length - 1; i >= 0; i--) {
    const { at, closers: owed } = commas[i]
    const cut = tryParse(text.slice(0, at) + owed)
    if (cut !== undefined) return cut
  }
  return undefined
}
