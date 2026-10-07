/** Tag rules of A1: lower-case, at most 12 tags of 24 characters, no duplicates. */
export const MAX_TAGS = 12
export const MAX_TAG_LENGTH = 24

/** "  Title Slides, " -> "title slides"; empty when nothing is left. */
export const normaliseTag = (text: string): string =>
  text
    .replace(/[,\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim()

/** The tags with `text` added, or the same array when it is empty, a duplicate or over the limit. */
export function addTag(tags: readonly string[], text: string): readonly string[] {
  const tag = normaliseTag(text)
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags
  return [...tags, tag]
}

export const removeTag = (tags: readonly string[], tag: string): string[] =>
  tags.filter((t) => t !== tag)
