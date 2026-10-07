/** File-name helpers for files the app writes into a lesson (plugin outputs, exports). */
import { extname } from 'node:path'
import type { DocumentKind } from '@shared/contracts/deck-builder-chat'

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001F]/g
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX_LENGTH = 120

/** A name Windows accepts: forbidden characters removed, no reserved name, no trailing dots or spaces. */
export function safeFileName(name: string, fallback = 'File'): string {
  const ext = extname(name)
  let base = name
    .slice(0, name.length - ext.length)
    .replace(FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
  base = base.slice(0, MAX_LENGTH).replace(/[. ]+$/, '')
  if (!base) base = fallback
  if (RESERVED.test(base)) base = `${base} file`
  return `${base}${ext.replace(FORBIDDEN, '')}`
}

/** `Quiz (2).docx` for the n-th attempt at the same name (n >= 2). */
export function numberedName(name: string, n: number): string {
  const ext = extname(name)
  return `${name.slice(0, name.length - ext.length)} (${n})${ext}`
}

const DOCUMENT_KINDS: Record<string, DocumentKind> = {
  '.docx': 'docx',
  '.pdf': 'pdf',
  '.pptx': 'pptx'
}

/** The kind of document a file name is, or undefined for anything else. */
export const documentKindOf = (name: string): DocumentKind | undefined =>
  DOCUMENT_KINDS[extname(name).toLowerCase()]
