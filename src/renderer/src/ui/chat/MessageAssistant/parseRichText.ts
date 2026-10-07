/** A run of text, optionally bold. */
export interface Inline {
  text: string
  bold: boolean
}

/** A paragraph (its lines are joined with line breaks) or a bullet list. */
export type Block = { type: 'p'; lines: Inline[][] } | { type: 'ul'; items: Inline[][] }

const BULLET = /^\s*[-*•]\s+(.*)$/

/** Split one line on **bold** markers. Unpaired markers stay as plain text. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = []
  const pattern = /\*\*(.+?)\*\*/g
  let last = 0
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (match.index > last) out.push({ text: line.slice(last, match.index), bold: false })
    out.push({ text: match[1] ?? '', bold: true })
    last = match.index + match[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false })
  return out
}

/**
 * Turn Claude's plain text into blocks: blank lines separate paragraphs, lines starting with
 * "-", "*" or "•" form bullet lists, `**bold**` is the only inline markup. Nothing is HTML.
 */
export function parseRichText(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') {
      current = null
      continue
    }
    const bullet = BULLET.exec(raw)
    if (bullet) {
      if (current?.type !== 'ul') {
        current = { type: 'ul', items: [] }
        blocks.push(current)
      }
      current.items.push(parseInline(bullet[1] ?? ''))
    } else {
      if (current?.type !== 'p') {
        current = { type: 'p', lines: [] }
        blocks.push(current)
      }
      current.lines.push(parseInline(raw.trim()))
    }
  }
  return blocks
}
