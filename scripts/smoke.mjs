// Smoke test = the `startup` e2e flow (scripts/e2e/startup.e2e.mjs) against the BUILT app.
//
//   npm run smoke                                        builds, then tests out/ via Electron
//   node scripts/smoke.mjs --exe "release/win-unpacked/Slide Planner.exe"   a packaged exe instead
//
// Exit code is 0 when every check passes, 1 otherwise. Screenshots land in .artifacts/shots/.
import { main } from './e2e/run.mjs'

process.exit(await main(['--only', 'startup', ...process.argv.slice(2)]))
