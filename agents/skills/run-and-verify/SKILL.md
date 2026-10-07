---
name: run-and-verify
description: Build, type-check, test and actually launch the Planning App to confirm a change works, including taking and reading screenshots. Use before declaring any change done, when asked to run or test the app, or when debugging a startup or UI problem.
---

# Run and verify

Compiling is not proof. This app has an end-to-end smoke test; use it.

## 0. Environment trap (do this first in every shell)

VS Code's extension host, and so any agent running inside VS Code, sets `ELECTRON_RUN_AS_NODE=1`. With it set,
Electron runs as plain Node and the app crashes with `Cannot read properties of undefined (reading 'isPackaged')`.

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue     # PowerShell
```
```bash
unset ELECTRON_RUN_AS_NODE                                              # bash
```

Shell state does not persist between tool calls, so repeat it in each command that launches Electron.
(`npm run smoke` and the F5 config already strip it.)

## 1. The standard checks

```powershell
npm run typecheck     # both TypeScript projects must be clean
npm test              # Vitest unit tests
npm run smoke         # builds, launches the real app, asserts the startup flow, saves screenshots
```

`npm run smoke` checks: splash shows "Welcome" and "Alice", the close X is in the top-right corner, the splash hands
over to the app, the home module renders, at least one module is discovered, the renderer <-> main round trip works,
maximise/restore work, no renderer console errors, and the X quits the app. Expect `N/N checks passed`.

**Look at the pictures.** Read `.artifacts/smoke/1-splash-early.png`, `2-splash-late.png` and `3-app.png` with the image
reader. A passing check list does not prove the UI looks right.

## 2. Checking your own feature

Write a scratch CommonJS script (outside the repo, e.g. in your scratchpad) and run it with `node`. It resolves
`playwright-core` and `electron` from the repo's `node_modules`, so it works from any folder:

```js
const path = require('node:path'), os = require('node:os'), fs = require('node:fs')
const repo = 'C:/GIT/PlanningApp'                                       // adjust if the repo moved
const req = require('node:module').createRequire(path.join(repo, 'package.json'))
const { _electron: electron } = req('playwright-core')
const { ELECTRON_RUN_AS_NODE: _x, ...env } = process.env
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-check-'))     // throwaway profile (avoids the single-instance lock)

;(async () => {
  const app = await electron.launch({ executablePath: req('electron'), args: [repo, '--user-data-dir=' + userData], cwd: repo, env })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-testid="home"]', { timeout: 20000 })  // the splash takes ~3.2 s; Home is the first module (order 0)
  await page.click('[data-testid="nav-<your-module-id>"]')
  await page.screenshot({ path: path.join(os.tmpdir(), 'my-feature.png') })
  // call the main process directly:
  console.log(await page.evaluate(() => window.api.modules.invoke('<id>', '<channel>' /*, args */)))
  await page.evaluate(() => window.api.window.close())                     // quit through the app
  fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})()
```

Run `npm run build` first; the smoke script builds, a hand-written script does not. If the check is valuable long term,
add it to `scripts/smoke.mjs`.

## 3. Other ways to run

| Goal | Command |
|---|---|
| Hot-reload while editing | `npm run dev` (needs `ELECTRON_RUN_AS_NODE` unset) |
| Run the production build | `npm start` (builds, then launches) |
| Test a packaged exe | `node scripts/smoke.mjs --exe "release/win-unpacked/Planning App.exe"` |
| Drive dev mode over CDP | set `REMOTE_DEBUGGING_PORT=9222`, run `electron-vite dev`, then `chromium.connectOverCDP('http://127.0.0.1:9222')` |

`electron.exe` is a GUI program: its stdout is not captured by a plain `& electron.exe` in PowerShell. To read main-process
logs use `Start-Process -RedirectStandardOutput out.txt -RedirectStandardError err.txt -WindowStyle Hidden ...`, wait a few
seconds, then stop it (`Get-Process electron | Stop-Process -Force`). Main-process `log.error` output goes to stderr.

## 4. Cleanup

Stray windows are annoying for the user: make sure no `electron` / `Planning App` processes are left running
(`Get-Process electron, 'Planning App' -ErrorAction SilentlyContinue | Stop-Process -Force`), and delete temp user-data
dirs you created.

## Done when

- typecheck and unit tests are clean, `npm run smoke` reports all checks passed, screenshots were read and look right,
  and any feature-specific check you wrote passed. Say exactly what you ran and what you did not.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `reading 'isPackaged'` crash | `ELECTRON_RUN_AS_NODE` is set: see step 0 |
| `Process failed to launch!` from Playwright | same cause, or the app crashed at startup: run it with redirected output |
| `Downloading Electron binary...` | normal on the first run: Electron fetches its binary lazily (`scripts/ensure-deps.mjs` does it for F5) |
| App exits immediately, no window | another instance holds the single-instance lock: use a different `--user-data-dir` or close it |
| Module missing from the sidebar | check Home "Modules that failed to load" (UI side) and the main-process log (main side, stderr: `Skipped` / `Failed to activate`); id must equal folder name; folder must not start with `_` |
| Type errors only in one project | the file is outside that project's `include` globs (see `tsconfig.node.json` / `tsconfig.web.json`) |
