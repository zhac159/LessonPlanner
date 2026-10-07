# Planning App: guide for AI agents

**Read this file first.** It is the entry point to everything an agent needs to work on this codebase.
Humans are welcome too. Keep these docs current: they are the memory of this project.

## What this app is

A Windows desktop app that helps a teacher plan lessons, built around **PowerPoint**. The owner will:

1. upload the decks they have already made (as PDFs) so an AI learns their teaching and design style,
2. have Claude generate new decks for new lessons in that style,
3. refine the result in a **chat**, including **circling parts of a slide** and asking Claude to change them.

None of those three features exist yet. What exists today is the **framework** they will plug into:
an Electron app with a module system, an animated "Welcome Alice" splash, a frameless window with a
close (X) button at the top right, a sleek dark UI, tests, and packaging. See [ROADMAP.md](ROADMAP.md).

The app is meant to **grow by adding modules** (one folder per feature). The owner keeps adding
features and keeps adding skills to this `agents/` folder as the app develops.

## Stack at a glance

| Layer | Choice |
|---|---|
| Shell | Electron 44 (frameless window, custom title bar) |
| Language | TypeScript (strict), pinned to ~5.9 |
| UI | React 19, plain CSS with design tokens, lucide-react icons, Inter font |
| Build | electron-vite 5 (+ Vite 7, **not** 8: electron-vite 5 requires Vite 5 to 7) |
| Tests | Vitest (unit), Playwright-core driving Electron (smoke / end to end) |
| Packaging | electron-builder, Windows NSIS installer |
| Platform | Windows first. Node >= 22.12 |

Why these choices: [DECISIONS.md](DECISIONS.md).

## START HERE: build the product fast and cheap

The product (design direction B, no sign-in, all data in the app folder) is implemented module by module. Before writing code:

1. [IMPLEMENTATION.md](IMPLEMENTATION.md): ground rules, layering, typed contracts, who owns what.
2. [EFFICIENCY.md](EFFICIENCY.md): **token-saving playbook** (one-line test runs, reading specs by section, cheap screenshots, quirks).
3. [TESTING.md](TESTING.md): unit, component and the few integration tests, and the commands.

The three commands that save the most tokens: `npm run -s check` (types + unit + component in ~4 lines),
`node scripts/spec.mjs <doc> <heading>` (read one section of a design doc), `node scripts/shot.mjs <module> --seed home` (one screenshot
to compare with `design/images/`). Never read `design/design-system.md` whole and never read raw test output.

## Commands (run from the repo root)

| Command | What it does |
|---|---|
| `F5` in VS Code | Installs deps if needed, builds, launches the app with the debugger attached |
| `npm run dev` | Development with live reload (`electron-vite dev --watch`): renderer edits hot-reload, main-process edits restart Electron, preload edits reload the page |
| `npm run build` | Production build into `out/` (`build:debug` adds source maps) |
| `npm start` | `electron-vite preview`: builds and runs the production build |
| `npm run typecheck` | Type-checks the main-side and renderer-side projects |
| `npm test` | Unit tests (Vitest) |
| `npm run smoke` | Builds, launches the real app, checks the whole startup flow, saves screenshots to `.artifacts/smoke/` |
| `npm run new:module -- <id> ["Title"] [--main]` | Scaffolds a new module |
| `npm run skills:sync` | Mirrors `agents/skills/` into `.claude/skills/` |
| `npm run package` | Builds the Windows installer into `release/` |
| `npm run package:dir` | Builds an unpacked app (`release/win-unpacked/Planning App.exe`), faster |
| `npm run format` / `npm run format:check` | Prettier (the `design/` folder and Markdown are excluded) |

**Before you say a change is done:** `npm run typecheck`, `npm test`, and `npm run smoke` must all pass
(see the `run-and-verify` skill). For UI work, also open the screenshots the smoke test saves and look at them.

## Map of the repo

```
agents/                  this knowledge base (docs + skills)
design/                  the OWNER'S DESIGN (product brief, mockups, plugin spec). Source of truth for look and behaviour
scripts/                 node/PowerShell helpers (smoke test, module generator, skill sync, icon, dep check)
resources/icon.png       app icon (window + .exe), regenerate with scripts/make-icon.ps1
src/
  main/                  Electron main process: window, core IPC, module loader, module bus
  preload/               the contextBridge that exposes window.api to the renderer
  shared/                code and types used by both sides (IPC channel names, API contract, module registry)
  renderer/              the React app: shell (title bar, sidebar, splash, module host) and styles
  modules/<id>/          FEATURE MODULES. Each folder is one feature. Auto-discovered.
    home/                the reference module; copy its patterns
.vscode/                 F5 launch configs, tasks, settings
electron.vite.config.ts  build config (path aliases live here and in tsconfig.*.json)
electron-builder.yml     packaging config
```

## Reading order

1. This file.
2. [ARCHITECTURE.md](ARCHITECTURE.md): processes, startup sequence, IPC, security, styling.
3. [MODULES.md](MODULES.md): how to build a feature module (the thing you will do most).
4. [CONVENTIONS.md](CONVENTIONS.md): code style and the rules of the codebase.
5. [ROADMAP.md](ROADMAP.md): the product vision, how it maps to the design, and the planned modules.
6. [DECISIONS.md](DECISIONS.md): why things are the way they are. Read before changing the foundations.
7. [skills/](skills/README.md): step-by-step playbooks for recurring tasks.
8. [CHANGELOG.md](CHANGELOG.md): what changed and when.

## Rules for agents

0. **`design/` decides how the app looks and behaves; `agents/` decides how it is built.** Before UI or product work read
   [design/README.md](../design/README.md), [design/product-brief.md](../design/product-brief.md) and
   [design/AGENTS.md](../design/AGENTS.md); if the code must deviate from a mockup, say why in the relevant doc. A separate design
   session maintains `design/`: do not edit it from a coding task except to record a deviation. The visual direction (A Studio,
   B Classroom, C Focus) was **not yet picked** when the framework was built, so the current dark violet theme is a placeholder
   (see ROADMAP.md "Design alignment").
1. **A feature is a module.** Add `src/modules/<id>/`; do not edit the shell to register it. Only change core
   (`src/main`, `src/preload`, `src/shared`, `src/renderer/src/{core,components}`) when the framework itself
   must change, and record why in [DECISIONS.md](DECISIONS.md).
2. **The renderer is sandboxed and offline.** Anything that touches the network, the file system, secrets
   (API keys) or other processes belongs in a module's `main.ts`, never in `ui.tsx`.
3. **Do not add IPC channels or preload methods for features.** Use the module `invoke` / `emit` pair.
4. **Verify by running the app**, not just by compiling. `npm run smoke` exists for this.
5. **Keep the docs true.** If you change behaviour, update the matching doc in the same change and add a line to
   [CHANGELOG.md](CHANGELOG.md). Use the `update-agents-docs` skill. If you add a skill, put it in
   `agents/skills/<name>/SKILL.md` and run `npm run skills:sync`.
6. **Do not rewrite the owner's choices** (name shown on the splash, the look, the module-per-feature layout)
   without being asked.
7. **If F5 seems to do nothing**, another instance (an installed copy, or an earlier debug run) holds the single-instance lock: the
   second launch exits silently. Close the other one.
8. **Known trap:** if Electron starts as plain Node (`Cannot read properties of undefined (reading 'isPackaged')`),
   the environment variable `ELECTRON_RUN_AS_NODE` is set. VS Code's extension host sets it, so any agent running
   inside VS Code inherits it. Unset it (`Remove-Item Env:ELECTRON_RUN_AS_NODE` in PowerShell) before running
   Electron yourself. `npm run smoke` and the F5 config already handle this.

## Skills in this repo

Listed in [skills/README.md](skills/README.md). The source of truth is `agents/skills/`; Claude Code reads the
mirrored copy in `.claude/skills/` (generated by `npm run skills:sync`, do not edit by hand).
