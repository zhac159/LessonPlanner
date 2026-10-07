/** Text hygiene for XML parts: PowerPoint "repairs" files that contain characters XML 1.0 forbids. */

const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/** Removes characters that are illegal in XML 1.0 and normalises line endings to `\n`. */
export function cleanText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(FORBIDDEN, '').replace(LONE_SURROGATE, '')
}

/** Like {@link cleanText} but flattens line breaks, for single-paragraph run text. */
export function cleanInline(text: string): string {
  return cleanText(text).replace(/\n+/g, ' ')
}
