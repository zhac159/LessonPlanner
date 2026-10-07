/** Pure helpers for the Dropzone: which dropped files it accepts and what it tells the user. */

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Split files by extension. `accept` is a list like ['.pdf', '.pptx'] (case-insensitive);
 * undefined or empty accepts everything.
 */
export function splitByExtension(
  files: ReadonlyArray<File>,
  accept?: ReadonlyArray<string>
): { accepted: File[]; rejected: File[] } {
  if (!accept || accept.length === 0) return { accepted: [...files], rejected: [] }
  const allowed = new Set(accept.map((ext) => ext.toLowerCase()))
  const accepted: File[] = []
  const rejected: File[] = []
  for (const file of files) (allowed.has(extensionOf(file.name)) ? accepted : rejected).push(file)
  return { accepted, rejected }
}

/**
 * While dragging, browsers hide file names but reveal MIME types. A drag is "valid" unless it carries
 * a known MIME type that is not accepted. Unknown or empty types get the benefit of the doubt.
 */
export function isDragAcceptable(
  types: ReadonlyArray<string>,
  accept?: ReadonlyArray<string>
): boolean {
  if (!accept || accept.length === 0) return true
  const allowed = new Set(accept.map((ext) => MIME_BY_EXTENSION[ext.toLowerCase()]).filter(Boolean))
  if (allowed.size === 0) return true
  return types.every((type) => type === '' || allowed.has(type))
}

/** "Only .pdf and .pptx files" (the not-accepted drag message). */
export function onlyMessage(accept: ReadonlyArray<string>): string {
  const list =
    accept.length <= 1
      ? accept.join('')
      : `${accept.slice(0, -1).join(', ')} and ${accept[accept.length - 1]}`
  return `Only ${list} files`
}

/** "Drop to add 3 files" / "Drop to add 1 file". */
export function dropMessage(count: number): string {
  return `Drop to add ${count} ${count === 1 ? 'file' : 'files'}`
}
