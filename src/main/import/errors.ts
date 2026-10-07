/** Failure reasons for style source files; `message` is the exact text the UI shows (04-create-style.md). */
export type ImportFailureCode =
  | 'password'
  | 'scanned'
  | 'corrupt'
  | 'empty'
  | 'too-large'
  | 'too-many'
  | 'unsupported'
  | 'old-ppt'
  | 'duplicate'
  | 'missing'

export const IMPORT_MESSAGES: Record<ImportFailureCode, string> = {
  password: 'Password protected',
  scanned: 'This PDF is scanned images only',
  corrupt: 'This file is damaged',
  empty: 'No slides found',
  'too-large': 'Over 50 MB',
  'too-many': 'Up to 50 files per style',
  unsupported: 'Only PDF and PowerPoint files',
  'old-ppt': '.ppt files are too old to read. Save them as .pptx first.',
  duplicate: 'Already added',
  missing: 'This file can’t be found'
}

/** Thrown by the digest readers; carries a machine code plus the readable reason. */
export class ImportError extends Error {
  readonly code: ImportFailureCode
  constructor(code: ImportFailureCode) {
    super(IMPORT_MESSAGES[code])
    this.name = 'ImportError'
    this.code = code
  }
}

export const isImportError = (error: unknown): error is ImportError => error instanceof ImportError
