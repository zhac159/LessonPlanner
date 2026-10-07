// Starts the BUILT app with a Chrome DevTools port so a Playwright MCP server can attach to the
// real window (see .mcp.json, server "slide-planner-app"). Runs until you press Ctrl+C or the
// window is closed. Throwaway data folder, fake AI and test mode unless you pass flags.
//
//   node scripts/e2e/debug-app.mjs [--seed <name>] [--port 9222] [--real-ai]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appEnvironment, root } from './lib.mjs'

const argv = process.argv.slice(2)
const value = (flag) => argv[argv.indexOf(flag) + 1]
const port = argv.includes('--port') ? Number(value('--port')) : 9222
const dataDir = mkdtempSync(join(tmpdir(), 'slide-planner-data-'))
const profileDir = mkdtempSync(join(tmpdir(), 'slide-planner-profile-'))
const electron = createRequire(import.meta.url)('electron')

const child = spawn(
  electron,
  [root, `--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`],
  {
    cwd: root,
    stdio: 'ignore',
    env: appEnvironment({
      dataDir,
      fakeAi: !argv.includes('--real-ai'),
      seed: argv.includes('--seed') ? value('--seed') : undefined
    })
  }
)
console.log(`Slide Planner is running with DevTools on http://127.0.0.1:${port} (Ctrl+C to stop)`)

const cleanup = () => {
  child.kill()
  setTimeout(() => {
    for (const dir of [dataDir, profileDir]) {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
    process.exit(0)
  }, 500)
}
child.on('exit', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
