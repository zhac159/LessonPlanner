// One command, minimal output: type-check + unit + component tests (+ optional formatting).
// Prints ONE line per step when green and only compact failure details otherwise, so agents do not
// burn tokens reading logs.
//
//   npm run check                      types + unit + component
//   npm run check -- types             only the type-check
//   npm run check -- unit component    chosen steps (types | unit | component | format)
//   npm run check -- -f deck           only test files whose path contains "deck"
//   npm run check -- -t "undo"         only tests whose name matches
//   npm run check -- --all             also run prettier --check
//   npm run check -- --max 25          show up to 25 failure lines (default 12 per step)
//
// Exit code 0 = everything green. Add --keep to leave the raw vitest JSON in .artifacts/.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = join(root, '.artifacts')
mkdirSync(artifacts, { recursive: true })

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const fileFilter = flag('-f')
const nameFilter = flag('-t')
const maxLines = Number(flag('--max') ?? 12)
const valueArgs = new Set(['-f', '-t', '--max'])
const positional = args.filter((a, i) => !a.startsWith('-') && !valueArgs.has(args[i - 1]))
const STEPS = ['types', 'unit', 'component', 'format']
let steps = positional.filter((s) => STEPS.includes(s))
if (steps.length === 0) steps = ['types', 'unit', 'component']
if (args.includes('--all') && !steps.includes('format')) steps.push('format')

const bin = (name) =>
  join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

function run(command, commandArgs) {
  return new Promise((done) => {
    const started = performance.now()
    const child = spawn(command, commandArgs, {
      cwd: root,
      shell: process.platform === 'win32',
      env: { ...process.env, FORCE_COLOR: '0' }
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) =>
      done({ code: code ?? 1, out, seconds: (performance.now() - started) / 1000 })
    )
  })
}

const short = (text, n = 160) => (text.length > n ? text.slice(0, n - 1) + '…' : text)
const blocks = {}
const report = (name, ok, summary, details = []) => {
  const block = [`${name.padEnd(10)} ${ok ? 'ok  ' : 'FAIL'} ${summary}`]
  for (const d of details.slice(0, maxLines)) block.push(`    ${d}`)
  if (details.length > maxLines)
    block.push(`    … ${details.length - maxLines} more (use --max ${details.length})`)
  blocks[name] = block
}

async function typeStep() {
  const projects = ['node', 'web']
  const results = await Promise.all(
    projects.map((p) =>
      run(bin('tsc'), [
        '--noEmit',
        '--composite',
        'false',
        '--incremental',
        '--tsBuildInfoFile',
        join('.artifacts', `tsc-${p}.tsbuildinfo`),
        '--pretty',
        'false',
        '-p',
        `tsconfig.${p}.json`
      ])
    )
  )
  const errors = []
  for (const r of results) {
    for (const line of r.out.split(/\r?\n/)) {
      const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
      if (m) errors.push(`${m[1]}:${m[2]} ${m[4]} ${short(m[5], 140)}`)
      else if (/error TS\d+/.test(line)) errors.push(short(line))
    }
  }
  const seconds = Math.max(...results.map((r) => r.seconds)).toFixed(1)
  const failedToRun = results.some((r) => r.code !== 0) && errors.length === 0
  report(
    'types',
    errors.length === 0 && !failedToRun,
    errors.length
      ? `${errors.length} error(s)`
      : failedToRun
        ? 'tsc failed (see .artifacts)'
        : `(${seconds}s)`,
    errors
  )
}

async function vitestStep(project) {
  const outFile = join(artifacts, `vitest-${project}-${process.pid}.json`)
  const vitestArgs = [
    'run',
    '--project',
    project,
    '--reporter=json',
    // The JSON reporter prints nothing about unhandled errors although they fail the run (exit code 1): a second
    // reporter makes them show up in the output kept for that case (see below).
    '--reporter=dot',
    `--outputFile.json=${outFile}`,
    '--passWithNoTests'
  ]
  if (fileFilter) vitestArgs.push(fileFilter)
  if (nameFilter) vitestArgs.push('-t', nameFilter)
  const r = await run(bin('vitest'), vitestArgs)
  if (!existsSync(outFile)) {
    report(
      project,
      false,
      'vitest produced no result',
      r.out
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-6)
        .map((l) => short(l))
    )
    return
  }
  let json
  try {
    json = JSON.parse(readFileSync(outFile, 'utf8'))
  } catch {
    report(project, false, 'could not read vitest JSON', [])
    return
  }
  if (!args.includes('--keep')) rmSync(outFile, { force: true })
  const failures = []
  for (const file of json.testResults ?? []) {
    const rel = relative(root, file.name).replace(/\\/g, '/')
    const failedTests = (file.assertionResults ?? []).filter((t) => t.status === 'failed')
    for (const t of failedTests) {
      const msg = (t.failureMessages?.[0] ?? '')
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .slice(0, 3)
        .join(' | ')
      failures.push(`✗ ${rel} > ${t.fullName}`, `    ${short(msg, 200)}`)
    }
    if (file.status === 'failed' && failedTests.length === 0) {
      failures.push(
        `✗ ${rel} (suite failed to run)`,
        `    ${short(
          (file.message ?? '')
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .slice(0, 2)
            .join(' | '),
          200
        )}`
      )
    }
  }
  const total = json.numTotalTests ?? 0
  const failed = json.numFailedTests ?? 0
  const files = (json.testResults ?? []).length
  const ok = r.code === 0 && failures.length === 0
  if (r.code !== 0 && failures.length === 0) {
    // Every test passed but vitest still exited non-zero: leaked async work (unhandled error/rejection) or a
    // crashed worker. Keep the raw output and show the lines that explain it, so nobody has to guess.
    const raw = join(artifacts, `check-${project}-${process.pid}.log`)
    writeFileSync(raw, r.out)
    const lines = r.out.split(/\r?\n/)
    const at = lines.findIndex((l) => /Unhandled|Error:|Serialized Error|Worker|exited/i.test(l))
    failures.push(
      `✗ vitest exited with code ${r.code} although no test failed (raw output: ${relative(root, raw)})`
    )
    for (const l of lines
      .slice(Math.max(at, 0))
      .filter((l) => l.trim())
      .slice(0, 6))
      failures.push(`    ${short(l, 200)}`)
  }
  report(
    project,
    ok,
    ok
      ? `${total} tests / ${files} files (${r.seconds.toFixed(1)}s)`
      : `${failed} of ${total} tests failed, ${files} files`,
    failures
  )
}

async function formatStep() {
  const r = await run(bin('prettier'), ['--check', '--log-level', 'warn', '.'])
  const bad = r.out
    .split(/\r?\n/)
    .filter((l) => l.startsWith('[warn]') && !/Code style issues/.test(l))
    .map((l) => l.replace('[warn] ', ''))
  report(
    'format',
    r.code === 0,
    r.code === 0 ? '' : `${bad.length} file(s) need "npm run format"`,
    bad
  )
}

const t0 = performance.now()
// Types and tests do not depend on each other: run them side by side.
await Promise.all(
  steps.map((s) => (s === 'types' ? typeStep() : s === 'format' ? formatStep() : vitestStep(s)))
)
const lines = STEPS.flatMap((name) => blocks[name] ?? [])
console.log(lines.join('\n'))
const failed = lines.some((l) => /^\S+\s+FAIL/.test(l))
console.log(
  failed
    ? `\ncheck: FAILED (${((performance.now() - t0) / 1000).toFixed(1)}s)`
    : `check: all green (${((performance.now() - t0) / 1000).toFixed(1)}s)`
)
process.exit(failed ? 1 : 0)
