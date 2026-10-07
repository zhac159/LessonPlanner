# Testing

Three layers, cheapest first. Run **`npm run -s check`** (types + unit + component) after every change; it prints one
line per step when green and only compact failure details otherwise.

```
npm run -s check                    # everything fast; ~4 lines when green
npm run -s check -- -f deck         # only test files whose path contains "deck"  (types still run)
npm run -s check -- unit -t undo    # one project, tests whose name matches "undo"
npm run -s check -- types           # type-check only
npm run -s check -- --all           # also prettier --check
npm run -s check -- --max 30        # show more failure lines (default 12)
```

Add `--keep` to leave the raw vitest JSON in `.artifacts/vitest-<project>-<pid>.json` if you need detail. Never run raw `vitest` or `tsc` and read
their full output.

## Unit tests (`*.test.ts`, node)
Pure logic (`src/shared`), main-side services and AI/export/import code. Use `fs.mkdtempSync(os.tmpdir() + …)` for files,
inject the `AiService` (use `src/main/ai/fake.ts` or a hand-written stub), never touch the network or `electron`.

## Component tests (`*.test.tsx`, happy-dom + Testing Library)
Every UI-kit component and screen. Test **behaviour a user can see**: roles, labels, text, disabled/error/loading states,
keyboard use, callbacks, accessibility attributes. No snapshots. Use `@testing-library/user-event`. Screens get data from
hooks that call typed clients; wrap them with the fake client provider from `@test/render` (`renderWithApp(ui, { clients })`).
happy-dom has no layout: do not assert pixel sizes; assert classes/attributes/ARIA.

## Integration tests (`scripts/e2e/*.e2e.mjs`, real Electron + Playwright)
Slow (~7 s per flow). Keep to a handful of whole-flow checks (startup, first run, home, style, lesson, export), always with the fake AI
(`SLIDE_PLANNER_FAKE_AI=1`) and a throwaway data dir. Everything else belongs in unit/component tests.

```
npm run test:e2e                          # build, then every flow: one PASS/FAIL line per flow
node scripts/e2e/run.mjs --only startup   # flows whose file name contains "startup" (no build)
node scripts/e2e/run.mjs --exe "release/win-unpacked/Slide Planner.exe"   # against the packaged exe
npm run smoke                             # = the startup flow
```

A flow is `export default async ({ launch, check, go, shot, settle, sleep, waitForSplashGone }) => { ... }`. `launch({ seed, dataDir, env })`
returns `{ app, page, dataDir, errors, close }` (cleanup is automatic); `check(name, ok, detail)` throws on failure; `go(page, moduleId, intent)`
navigates via `window.__shell` (test mode). A failing flow prints the error, recent renderer errors and writes
`.artifacts/e2e/<flow>-failure.png`. Helpers: `scripts/e2e/lib.mjs`; pure argument parsing is unit-tested in `src/tooling/e2eArgs.test.ts`.

## Contract tests (`src/shared/contracts/*.test.ts`)
Each contract file exports its method and event name lists via `keysOf<Api>()([...])` (`names.ts`): a missing or unknown name is a compile
error, and the tests assert every name matches `CHANNEL_PATTERN` of `src/main/moduleBus.ts` and that sample objects satisfy the types.

## Visual checks
`node scripts/shot.mjs <moduleId> [--intent <json>] [--seed <name>] [--size 1440x940] [--name <file>]` launches the built app (fake AI, test mode,
reduced motion), jumps to the module, waits until it is still and writes `.artifacts/shots/<name>.png` (prints only the path). Read that PNG
next to `design/images/<NN>-*.png` (same 1440 width). Run `npm run build` first; the script does not build. For interactive exploration use the
Playwright MCP servers in `.mcp.json` (see `agents/EFFICIENCY.md`).
