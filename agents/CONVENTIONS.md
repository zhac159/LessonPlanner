# Conventions

Follow what is already in the code; these are the rules behind it.

## Language and style

- TypeScript, `strict`, plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Prefix an
  intentionally unused parameter with `_`. Avoid `any`; use `unknown` and narrow.
- Prettier decides formatting (`.prettierrc`: no semicolons, single quotes, 100 columns, no trailing commas). Run
  `npm run format` (`npm run format:check` must pass; `design/` is excluded). Markdown is excluded from Prettier.
- LF line endings, UTF-8, 2-space indent (`.editorconfig`).
- Comments explain *why*, not what. Doc comments (`/** */`) on exported APIs and non-obvious constants. No commented-out code.
- React: function components, hooks, no class components except an error boundary. Annotate props types; let return
  types be inferred for components.
- Files: components `PascalCase.tsx`, everything else `camelCase.ts`; module folders and ids `kebab-case`.
  One component per file, with its CSS next to it (`Splash.tsx` + `Splash.css`).
- Imports: use the aliases `@shared/*`, `@main/*`, `@renderer/*`, `@modules/*` across folders, relative paths inside a folder.
  Modules import only from their own folder, `@renderer/sdk` / `@main/sdk`, `@shared/*` and npm packages.

## Architecture rules

- Features are modules (see [MODULES.md](MODULES.md)). Do not hard-wire a feature into the shell.
- The renderer never touches the network, the file system, `process`, or secrets. The main process does, via module handlers.
- No new IPC channels or preload methods for features. Core IPC changes are rare, must be added to `src/shared/ipc.ts`
  and `src/shared/api.ts` together with the preload and main implementations, and recorded in
  [DECISIONS.md](DECISIONS.md).
- Anything that crosses IPC is validated in main and structured-clonable.
- `src/shared` is pure TypeScript: no Node, Electron, DOM or React imports.
- Errors a user could see must be human-readable. Handler errors become the message shown in the UI.
- Log with `ctx.log` (module) or `createLogger(scope)` (core), not bare `console.log`, in main-side code.

## UI rules

- Use tokens (`var(--accent)` etc.) and the primitives in `base.css`. No hard-coded colours or magic spacing in new UI.
- Keep animation to `transform` and `opacity` where possible; respect `prefers-reduced-motion`.
- Everything interactive is keyboard-reachable, has an accessible name (`aria-label` or visible text) and a visible focus style.
- Add `data-testid` to elements that tests must find. Existing ids: `splash`, `splash-name`, `titlebar`,
  `window-minimize`, `window-maximize`, `window-close`, `shell`, `nav-<moduleId>`, `module-<moduleId>`, `home`,
  `home-module-count`, `home-main-status`.
- The window is frameless: clickable elements inside the title bar need `-webkit-app-region: no-drag`.

## Dependencies

- Pin to what electron-vite supports: **Vite 7 (not 8)**, **@vitejs/plugin-react 5**, **TypeScript ~5.9**. Check
  peer ranges before bumping any of them; electron-vite 6 (beta) is expected to move Vite forward.
- Libraries the renderer or main code imports get bundled by Vite, so add them with `npm install -D <pkg>`. Only a
  native module, or one that must stay external at runtime, goes in `dependencies` (that is what electron-builder ships).
- Electron downloads its binary lazily. `scripts/ensure-deps.mjs` (used by F5) fetches it; `require('electron')` also does.

## Testing

- **Unit**: Vitest, files `src/**/*.test.ts` (type-checked by the node project), node environment. Test pure logic (the registry, parsers, data transforms).
  Code that imports `electron` cannot be unit-tested directly; keep logic in plain functions and test those.
- **End to end**: `scripts/smoke.mjs` launches the real app through Playwright and asserts the startup flow, the
  close button and the main-process round trip. Extend it when you add behaviour that must never regress.
- Verify visually: read the screenshots in `.artifacts/smoke/`. `smoke.mjs` assumes Home is the first module and the splash lasts ~3 s; update it if either changes.
- A feature is not done until typecheck, unit tests and the smoke test pass.

## Version control and housekeeping

- This repo was created outside git. If it is put under git, `.gitignore` already excludes `node_modules/`, `out/`,
  `release/` and `.artifacts/`. Commit `.claude/skills/` (generated, but needed by fresh clones).
- Keep `agents/` truthful: when you change a command, a path, a convention or the architecture, update the doc and add
  a [CHANGELOG.md](CHANGELOG.md) line in the same change.
