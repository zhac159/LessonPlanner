/** The words for "some parts of this vector picture are not shown" (library detail pane). */

const PARTS: Array<[RegExp, string]> = [
  [/^<image>$/, 'embedded pictures'],
  [/^<foreignObject>$/, 'embedded web content'],
  [/^<(?:animate\w*|set)>$/, 'animation'],
  [/^<script>$/, 'scripts'],
  [/^<a>$/, 'links'],
  [/^css:/, 'some styling'],
  [/^<(?:text|tspan|textPath)>$/, 'some text'],
  [/^@(?:href|xlink:href)$/, 'links to other files'],
  [
    /^(?:@|style:)(?:fill|stroke|stop-color|flood-color|color|opacity|filter|mask|clip-path)/,
    'some colours or effects'
  ]
]

/** What was left out, in plain words: `['embedded pictures', 'some colours or effects']`. */
export function leftOutParts(dropped: readonly string[]): string[] {
  const out: string[] = []
  for (const label of dropped) {
    const words = PARTS.find(([pattern]) => pattern.test(label))?.[1] ?? 'some effects'
    if (!out.includes(words)) out.push(words)
  }
  return out
}

/** `embedded pictures and some styling`; empty when nothing was left out. */
export function leftOutSentence(dropped: readonly string[] | undefined): string {
  const parts = leftOutParts(dropped ?? [])
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
