// Print ONE section of a Markdown spec instead of reading the whole file (saves thousands of tokens).
//
//   node scripts/spec.mjs                         list spec files with their headings count
//   node scripts/spec.mjs design-system           list that file's headings (with line numbers)
//   node scripts/spec.mjs design-system Button    print the section whose heading contains "Button"
//   node scripts/spec.mjs 06-editor "Layout"      works for any file under design/ and agents/ (substring match)
//   node scripts/spec.mjs ai-pipeline 4.7 --all   print EVERY matching section, not just the first
//
// A section runs from its heading to the next heading of the same or a higher level.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [fileArg, headingArg, ...rest] = process.argv.slice(2).filter((a) => a !== '--all')
const showAll = process.argv.includes('--all')

function listMarkdown(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.chrome-profile', 'images', 'mockups', 'canvas', 'fixtures'].includes(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) listMarkdown(full, out)
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

const files = [...listMarkdown(join(root, 'design')), ...listMarkdown(join(root, 'agents'))]
if (!fileArg) {
  for (const f of files) console.log(relative(root, f).replace(/\\/g, '/'))
  process.exit(0)
}

const matches = files.filter((f) => relative(root, f).replace(/\\/g, '/').toLowerCase().includes(fileArg.toLowerCase()))
if (matches.length === 0) {
  console.error(`No spec file matches "${fileArg}". Run without arguments to list them.`)
  process.exit(1)
}
const file = matches.find((f) => f.toLowerCase().endsWith(`${fileArg.toLowerCase()}.md`)) ?? matches[0]
const lines = readFileSync(file, 'utf8').split(/\r?\n/)
const headings = []
let inFence = false
lines.forEach((line, i) => {
  if (/^```/.test(line)) inFence = !inFence
  const m = !inFence && /^(#{1,6})\s+(.*)$/.exec(line)
  if (m) headings.push({ line: i, level: m[1].length, text: m[2] })
})

if (!headingArg) {
  console.log(`# ${relative(root, file).replace(/\\/g, '/')} (${lines.length} lines)`)
  for (const h of headings) console.log(`${String(h.line + 1).padStart(5)}  ${'  '.repeat(h.level - 1)}${h.text}`)
  process.exit(0)
}

const wanted = [headingArg, ...rest].join(' ').toLowerCase()
const found = headings.filter((h) => h.text.toLowerCase().includes(wanted))
if (found.length === 0) {
  console.error(`No heading containing "${wanted}" in ${relative(root, file)}. Run "node scripts/spec.mjs ${fileArg}" to list headings.`)
  process.exit(1)
}
for (const h of showAll ? found : found.slice(0, 1)) {
  const next = headings.find((n) => n.line > h.line && n.level <= h.level)
  const end = next ? next.line : lines.length
  console.log(lines.slice(h.line, end).join('\n').trimEnd())
  if (showAll) console.log('\n---')
}
if (!showAll && found.length > 1) console.error(`(${found.length - 1} more heading(s) also match; use --all)`)
