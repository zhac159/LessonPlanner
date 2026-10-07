/** Clean text from third-party APIs before it reaches the UI or a credit line. */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

/** Commons metadata values are HTML ("<a href=...>Name</a>"): reduce to plain text. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === '#') {
        const code =
          name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        return Number.isFinite(code) && code > 0 && code < 0x110000
          ? String.fromCodePoint(code)
          : ' '
      }
      return ENTITIES[name.toLowerCase()] ?? whole
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** Cut long text (some libraries put whole HTML blocks in title or author fields). */
export function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}
