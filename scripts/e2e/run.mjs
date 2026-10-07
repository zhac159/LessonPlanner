// Runs every scripts/e2e/*.e2e.mjs flow sequentially against the BUILT app and prints ONE line per
// flow (details only on failure). A flow is `export default async (ctx) => { ... }` and throws to fail.
//
//   npm run test:e2e                           builds, then runs all flows
//   node scripts/e2e/run.mjs --only startup    flows whose file name contains "startup" (no build)
//   node scripts/e2e/run.mjs --exe "release/win-unpacked/Slide Planner.exe"   a packaged exe
//   node scripts/e2e/run.mjs --list            just list the flows
//
// Exit code 0 when every flow passes. A failing flow leaves .artifacts/shots/<flow>-failure.png.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { briefError, formatFlowLine, parseRunArgs } from './args.mjs'
import {
  check,
  go,
  invoke,
  launchApp,
  root,
  settle,
  shot,
  takeCheckCount,
  waitForSplashGone,
  waitUntil
} from './lib.mjs'

const flowDir = join(root, 'scripts', 'e2e')
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** File names of the flows, sorted, optionally filtered by a fragment. */
export function listFlows(only) {
  return (
    readdirSync(flowDir)
      .filter((file) => file.endsWith('.e2e.mjs') && (!only || file.includes(only)))
      // real-ai.e2e.mjs spends real money: it is a standalone script (`node scripts/e2e/real-ai.e2e.mjs --real`).
      .filter((file) => file !== 'real-ai.e2e.mjs')
      .sort()
  )
}

/** The object each flow receives: launches are tracked so the runner always cleans them up. */
function createContext(exe, launched) {
  return {
    root,
    check,
    go,
    invoke,
    waitUntil,
    shot,
    settle,
    sleep,
    waitForSplashGone,
    /** Same options as launchApp; the packaged `--exe` is applied automatically. */
    async launch(options = {}) {
      const instance = await launchApp({ exe: exe ?? undefined, ...options })
      launched.push(instance)
      return instance
    }
  }
}

async function runFlow(file, { exe, timeoutSeconds }) {
  const name = file.replace('.e2e.mjs', '')
  const launched = []
  const started = Date.now()
  takeCheckCount()
  let failure = null
  let timer
  try {
    const flow = (await import(pathToFileURL(join(flowDir, file)).href)).default
    if (typeof flow !== 'function') throw new Error(`${file} must default-export an async function`)
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`timed out after ${timeoutSeconds}s`)),
        timeoutSeconds * 1000
      )
    })
    await Promise.race([flow(createContext(exe, launched)), timeout])
  } catch (error) {
    failure = error
  } finally {
    clearTimeout(timer)
  }
  const seconds = (Date.now() - started) / 1000
  const checks = takeCheckCount()
  const lines = [formatFlowLine(name, failure === null, seconds, checks)]
  if (failure) {
    lines.push(...(await describeFailure(name, failure, launched)))
  }
  for (const instance of launched) await instance.close()
  return { passed: failure === null, seconds, lines }
}

/** The error, the last renderer errors, and a screenshot path: all a fixer needs, nothing more. */
async function describeFailure(name, failure, launched) {
  const lines = [`      ${briefError(failure).replaceAll('\n', '\n      ')}`]
  const last = launched.at(-1)
  if (!last) return lines
  if (last.errors.length > 0)
    lines.push(`      renderer: ${last.errors.slice(-3).join(' | ').slice(0, 400)}`)
  try {
    // The window is hidden: capture it through Electron (page.screenshot cannot).
    const file = await shot(last.page, `${name}-failure`)
    lines.push(`      screenshot: ${file}`)
  } catch {
    // The window may already be gone; the error above is what matters.
  }
  return lines
}

/** Runs the flows named by argv; returns the process exit code. */
export async function main(argv) {
  const args = parseRunArgs(argv)
  const flows = listFlows(args.only)
  if (args.list) {
    console.log(flows.map((file) => file.replace('.e2e.mjs', '')).join('\n'))
    return 0
  }
  if (flows.length === 0) {
    console.log(`e2e: no flows match "${args.only}"`)
    return 1
  }
  const started = Date.now()
  let passed = 0
  for (const file of flows) {
    const result = await runFlow(file, args)
    console.log(result.lines.join('\n'))
    if (result.passed) passed++
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`e2e: ${passed}/${flows.length} flows passed (${seconds}s)`)
  return passed === flows.length ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(
    await main(process.argv.slice(2)).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      return 1
    })
  )
}
