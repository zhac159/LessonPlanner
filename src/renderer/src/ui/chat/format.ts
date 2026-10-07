/** What an attachment is: a document kind, an image, or anything else. */
export type AttachmentKind = 'pdf' | 'pptx' | 'docx' | 'image' | 'file'

const KIND_BY_EXTENSION: Record<string, AttachmentKind> = {
  pdf: 'pdf',
  pptx: 'pptx',
  docx: 'docx',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image'
}

/** Classify a file name by its extension: documents, pictures, or plain `file`. */
export function attachmentKindOf(name: string): AttachmentKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase()
  return (ext && KIND_BY_EXTENSION[ext]) || 'file'
}

const TYPE_LABELS: Record<AttachmentKind, string> = {
  docx: 'Word document',
  pdf: 'PDF document',
  pptx: 'PowerPoint presentation',
  image: 'Image',
  file: 'File'
}

/** The plain-English type line of an attachment: "Word document". */
export function fileTypeLabel(kind: AttachmentKind): string {
  return TYPE_LABELS[kind]
}

/** A short size: "512 B", "48 KB", "1.2 MB". Invalid or negative sizes give an empty string. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10
  return `${mb} MB`
}
