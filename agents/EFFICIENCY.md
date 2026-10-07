# Working fast and token-lean in this repo

Goal: the fewest tokens and the least wall-clock time per verified change. Every command below prints a few lines when
things are fine; use them instead of raw tools.

## Commands (copy these)

| Need | Command | Output |
|---|---|---|
| Types + unit + component | `npm run -s check` | ~4 lines green, compact failures |
| Only my files | `npm run -s check -- -f <path fragment>` | same; `-t <test name>` narrows further |
| Types only / one project | `npm run -s check -- types` / `unit` / `component` | one line |
| Formatting | `npx prettier --write <my files>` (`check -- --all` verifies) | silent |
| One section of a design doc | `node scripts/spec.mjs <file> <heading>` | that section only |
| Headings of a design doc | `node scripts/spec.mjs <file>` | outline with line numbers |
| Integration flows | `npm run test:e2e` (builds first) or `node scripts/e2e/run.mjs --only <name>` | one line per flow |
| Smoke (startup flow) | `npm run smoke` | one line |
| Screenshot of a screen | `node scripts/shot.mjs <moduleId> [--intent <json>] [--seed <name>] [--size 1440x940]` | the PNG path |
| Drive the real app by hand (MCP) | `node scripts/e2e/debug-app.mjs`, then the `slide-planner-app` MCP server | see below |

Never run raw `vitest` or `tsc` and read their output; add `--max 30` to `check` for more failure lines, `--keep` for the raw JSON.

## Reading cheaply

- Specs: by section with `spec.mjs`. Never read `design/design-system.md` or a whole screen spec; read `6. Data`, `5. Content & copy`,
  `7. States` of the screen you build, and `design-system Button`-style sections for components.
- Code: `Grep -n` to find, then `Read` with `offset`/`limit`. Do not `cat` files; do not print logs.
- Do not re-read a file you just wrote or edited (Edit/Write fail loudly when something is wrong). Do not re-read for "verification".
- Images: read ONE screenshot and the matching `design/images/NN-*.png`, not a series. Shots are 1440 wide like the design images.
- Reuse before writing: search `src/shared`, `src/renderer/src/ui`, `src/main/services`, `src/shared/contracts` first.

## Choosing the cheapest test layer

1. Pure logic or a main-side service: unit test (`*.test.ts`), seconds.
2. A component or screen: component test (`*.test.tsx`) with fakes from `@test/*`. happy-dom has no layout, so assert roles,
   text, attributes, classes, callbacks.
3. Looks and layout: `shot.mjs` plus the design PNG, once per screen, at the end.
4. Whole-app wiring (IPC, windows, file system, packaged exe): an e2e flow. Max ~5 flows; one launch per flow; ~7 s each.
   Do not launch Electron for anything a component or unit test covers.

## Parallel agents

- Give each agent a disjoint set of paths (an "ownership list") and say that type errors elsewhere are someone else's work in progress.
- Agents report needs for other owners instead of editing outside their paths; the lead integrates docs (`agents/*.md`).
- Only one Electron launch at a time on the machine (shared single-instance lock and CPU). Component and unit runs are fine in parallel.
- Run the narrow `check -- -f <fragment>` while working and the full `check` once at the end.

## Visual and interactive verification

- `node scripts/shot.mjs <moduleId>` launches the built app (fake AI, test mode, reduced motion, throwaway data), jumps with
  `window.__shell.navigate`, waits until fonts and animations are idle and prints the PNG path. Needs `npm run build` first; it
  does not rebuild. `--seed <name>` fills the data folder (SLIDE_PLANNER_SEED, implemented in `src/main/dev/seed.ts`).
- Playwright MCP (`.mcp.json`, loaded at session start, needs the one-time approval in Claude Code): server `slide-planner-app`
  attaches over CDP to a running app (`node scripts/e2e/debug-app.mjs` in a terminal, port 9222); server `playwright` is a plain
  Edge for `design/mockups/*.html`. Prefer `shot.mjs` for a single look; use MCP only for interactive exploration (click, type,
  snapshot), because every MCP snapshot costs tokens.

## Do not

- Run the whole check after every edit, rebuild `out/` when only tests changed, or run `npm install` (all deps are present).
- Print or paste big outputs, whole test logs, `package-lock.json`, or generated files.
- Add snapshot tests, `sleep`-based waits in component tests, or a new e2e flow for something one component test can prove.
- Edit files you do not own, or `design/` (except an "Implementation note" line when you deliberately deviate).

## Quirks (Windows, Electron, tooling)

- `ELECTRON_RUN_AS_NODE=1` is set by VS Code and makes `electron.exe` behave like Node (`app` undefined). The scripts strip it
  (`cleanElectronEnv`); in a manual shell run `unset ELECTRON_RUN_AS_NODE` (bash) / `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell).
- GUI apps print nothing to a terminal's stdout on Windows: the main logger is console-only. Use Playwright (`app.evaluate`, `page.on('console')`) to observe the app; do not wait for terminal output.
- Single-instance lock: a second launch with the same `--user-data-dir` quits at once. Tests use a fresh temp profile each time.
- Data folder: tests and shots set `SLIDE_PLANNER_DATA_DIR` to a temp folder; never point them at the real `data/`.
- happy-dom has no layout engine: `getBoundingClientRect` is zeros, no `ResizeObserver` sizes. Do not assert pixels in component tests.
- Vitest globs: negation patterns are unreliable on Windows paths; filter with `check -- -f <fragment>` instead.
- `String.replace(x, str)` interprets `$$`, `$&`, `` $` `` in `str`: pass a function (`() => str`) when the text contains dollars.
- Bash heredocs in the Bash tool can truncate on quotes or backslashes (Windows paths such as `C:\x` lose the backslash): write files with
  the Write tool, not `cat <<EOF`. Use `\\` in TS strings holding Windows paths.
- Several agents run `check` at once: it writes `.artifacts/vitest-<project>-<pid>.json` per process, so runs do not clash; stale
  failures in files you do not own are others' work in progress.
- Windows paths: use absolute paths with the file tools; in scripts use `node:path` (`join`, `resolve`) and `pathToFileURL` for dynamic `import()`.
- `scripts/e2e/*.mjs` are plain Node modules (no TypeScript). Pure helpers live in `args.mjs` with `args.d.mts` types and are unit
  tested from `src/tooling/e2eArgs.test.ts`; Vitest only collects tests under `src/`.
- Interfaces are not assignable to an index signature, so `ContractShape` (`src/shared/contract.ts`) rejects `interface FooApi`:
  constrain generics with `C extends object` and map over `keyof C` (`ContractClient`, `ContractImpl`).
