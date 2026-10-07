/** Checks on the file paths the renderer sends (dropped or typed by a compromised page): never trusted. */
import { basename, isAbsolute } from 'node:path'
import type { RejectedFile } from '@shared/contracts/style-library'

/** More paths than this in one call are refused outright (a drop of a whole folder tree, or a bug). */
export const MAX_PATHS_PER_CALL = 500

export interface CleanedPaths {
  /** Absolute, de-duplicated paths for the styles service (which checks type, size and content). */
  paths: string[]
  /** Entries that were not usable paths at all. */
  invalid: RejectedFile[]
}

/** Splits `input` into usable absolute paths and rejects the rest; `undefined` when it is not a path list. */
export function cleanPaths(input: unknown): CleanedPaths | undefined {
  if (!Array.isArray(input) || input.length > MAX_PATHS_PER_CALL) return undefined
  const seen = new Set<string>()
  const paths: string[] = []
  const invalid: RejectedFile[] = []
  for (const entry of input as unknown[]) {
    if (typeof entry === 'string' && entry.trim() !== '' && isAbsolute(entry)) {
      if (!seen.has(entry)) {
        seen.add(entry)
        paths.push(entry)
      }
    } else {
      invalid.push({
        name: typeof entry === 'string' ? basename(entry) || entry : '',
        reason: 'type'
      })
    }
  }
  return { paths, invalid }
}

/** True for a non-empty string id (the service reports unknown ids as "not found"). */
export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200
