# Decisions

A log of the choices that shaped the foundation, with the reasoning, so nobody re-litigates them by accident.
To change one, add a new entry that supersedes it (do not silently rewrite history). Newest at the bottom.

## D1. Electron + TypeScript + React (2026-10-06)

(The "Python is not installed" premise was only partly true: Python is reachable through the `py` launcher but not on PATH; it was not a factor.)

**Chosen over** C# + WPF (the runner-up), Avalonia, Tauri (needs Rust, not installed), JavaFX, Python.

**Why:** the owner's priorities are a *sleek* look, an engaging **chat**, and the ability to **circle parts of a slide**
and have Claude change them. All three are easiest with web UI technology: CSS for polish and animation, trivial
streaming text, and an SVG/canvas overlay for annotation. Node 22 was already installed. The AI SDKs and most
rendering/export libraries (PptxGenJS, pdf.js) are strongest in JavaScript/TypeScript.

**Cost accepted:** larger install (the installer is ~106 MB, the unpacked app ~370 MB) and more RAM than a native app.
Measured on the packaged exe (2026-10-06, Windows 10): the welcome splash is on screen **~0.26 s** after launch (~0.76 s on
the very first run), the app is interactive when the 3.2 s intro ends, and idle memory is **~325 MB** summed across all
Electron processes. Mitigated by showing the splash immediately while modules load, lazy-loading, and a minified renderer.
The owner said performance matters "but not too much". Re-measure when heavy modules land.

**PowerPoint:** the plan is to generate `.pptx` files from an app-owned model (PptxGenJS) rather than automate the
installed PowerPoint, because the app is mostly *creating* decks from the owner's style. PowerPoint COM remains an
option for exact previews (see ROADMAP.md). WPF would have made COM easier; that was weighed and judged less important
than the UI and chat requirements.

## D2. electron-vite as the build tool; Vite 7, TypeScript 5.9 (2026-10-06)

electron-vite builds main, preload and renderer with one config and supports `import.meta.glob` in all three, which is
what makes module auto-discovery possible. electron-vite 5 supports Vite 5 to 7 only, so **Vite is pinned to ^7** and
`@vitejs/plugin-react` to ^5 (v6 needs Vite 8). TypeScript is pinned to ~5.9 for editor and tooling compatibility.
Revisit when electron-vite 6 ships stable.

The renderer is minified explicitly (`build.minify: 'esbuild'`): electron-vite left it unminified (668 kB -> 236 kB).
`package.json` has no `"type": "module"`, so main and preload build as CommonJS; a sandboxed preload cannot be ESM.

## D3. A feature is a folder (module system) (2026-10-06)

The owner wants to keep adding features. A module is `src/modules/<id>/` with `ui.tsx` (renderer), optional `main.ts`
(main process) and `shared.ts`. Both sides discover modules with lazy `import.meta.glob`, so adding a folder is the whole
registration; there is no central list to edit or forget.

- Lazy loaders plus per-file `Promise.allSettled` ([`src/shared/registry.ts`](../src/shared/registry.ts)): one broken module
  is reported and skipped instead of crashing startup. Verified by loading modules that throw, mismatch ids, or fail to activate.
- `id` must equal the folder name: it makes ids unique for free and lets the generator and docs rely on it.
- A `_` prefix disables a module (the glob has a negative pattern), which is cheaper and safer than a config flag.
- The UI entry is loaded eagerly at startup (the sidebar needs title and icon), so keep `ui.tsx` light and lazy-load heavy views inside the module.

## D4. One generic IPC pair for all modules (2026-10-06)

Instead of one preload method and IPC channel per feature, there are two: `modules:invoke` (request/response) and
`modules:event` (push). Handlers are registered at runtime in a map keyed `moduleId:channel`.

Why: the preload stays tiny and static (smaller attack surface, nothing to edit per feature), and modules stay
self-contained. Cost: payload types are not enforced by the bridge, so each module shares types and channel constants via
its `shared.ts`. Responses use an `{ ok, value | error }` envelope so UI code sees clean `Error` messages.

## D5. Sandboxed, offline renderer; privileged work in main (2026-10-06)

The renderer has no Node access (`sandbox`, `contextIsolation`, no `nodeIntegration`) and a CSP with
`connect-src 'self'`. All network, file and secret handling goes through module `main.ts`. The owner's Anthropic API
key must never be reachable from page code. Web permission requests are denied by default; navigation is locked.

## D6. Frameless window with a custom title bar (2026-10-06)

Requested: a sleek app with an X at the top right. The window is `frame: false` and `TitleBar.tsx` draws minimise,
maximise/restore and close, floating transparently over the splash. We chose not to use a transparent window (slow, hard to
resize) and not the native `titleBarOverlay` (limits styling such as the red close hover, which is custom here). The
trade-off is that Windows 11 snap-layout flyouts on the maximise button are not available.

## D7. Splash lives in the main window; the shell loads underneath (2026-10-06)

A separate splash window would double window management. Instead `App.tsx` mounts the shell immediately under the
`Splash`, invisible; the intro plays for 3.2 s (skippable by click or key after 0.8 s) and exits only when modules are
ready, then crossfades (0.6 s). "Loading" is therefore real, not a fake delay: the first module is already rendered when
the splash fades. Reduced-motion users get a 1.2 s fade.

## D8. Modules stay mounted after first visit (2026-10-06)

`ModuleHost` hides inactive modules instead of unmounting them. A chat mid-answer or an unsaved slide edit must not vanish
when the owner clicks another sidebar item. Modules get an `active` prop to pause work. If memory ever becomes a problem,
add an opt-out flag to `UiModule` rather than changing the default.

## D9. Agent knowledge lives in `agents/`; skills are mirrored for Claude Code (2026-10-06)

The owner asked for an `agents/` folder so future agents know the codebase, and to keep adding skills. Docs and skills live
in `agents/`; root `CLAUDE.md` and `AGENTS.md` are short pointers (Claude Code and other agents auto-load those).
Skills are authored in `agents/skills/<name>/SKILL.md` and copied to `.claude/skills/` by `npm run skills:sync`
(`--check` verifies sync) because Claude Code only discovers skills under `.claude/skills/`. One source of truth, no
symlinks (unreliable on Windows without developer mode).

## D10. Windows NSIS installer, not a portable exe (2026-10-06)

`npm run package` builds an assisted installer (`release/PlanningApp-Setup-<version>.exe`) with an install-mode page
(per-user needs no admin rights) and desktop/start-menu shortcuts. A portable single-file exe extracts itself to a temp
folder on every launch, which is slower, and the owner cares about startup performance. `npm run package:dir` produces an
unpacked folder (`release/win-unpacked/Planning App.exe`) for quick tests. The installer is **unsigned** (verified with
`Get-AuthenticodeSignature`), so Windows SmartScreen may warn the first time; code signing needs a certificate and is not
set up. The `author` field is missing from `package.json` (electron-builder warns); add the owner's name there when known.
The built installer has not been run on this machine; the unpacked exe passes the full smoke test (`--exe`).

## D11. Environment trap: `ELECTRON_RUN_AS_NODE` (2026-10-06)

Processes started from VS Code's extension host (which includes AI agents running in VS Code) inherit
`ELECTRON_RUN_AS_NODE=1`, which makes `electron.exe` run as plain Node, so `require('electron').app` is undefined and the
app dies with `Cannot read properties of undefined (reading 'isPackaged')`. The F5 launch config sets it to `null`, the smoke
test strips it from the environment it passes on, and the F5 task script does too. Anything new that spawns Electron must do the same.

## D12. Relationship to the `design/` folder (2026-10-06)

While the framework was being built, a separate design session produced `design/` (brief, three visual directions, plugin spec, mockups).
Decision: `design/` is the source of truth for look and behaviour; `agents/` for how it is built; code sessions do not edit `design/` except to
note a deviation, and design sessions do not edit `agents/`. The framework's theme and font are explicitly provisional until a direction is
picked, and every palette value now lives in `tokens.css` (plus `APP_CONFIG.windowBackground`) so a re-skin is one small change. The design's
"plugin" concept is **not** the same as a code module; see ROADMAP.md "Design alignment". Where the mockups assume a server (API key "stored
on the server", sign-in) the desktop app stores things locally instead, and the owner is asked before any sign-in is built.

## D13. Hardening round after the independent review (2026-10-06)

A four-reviewer audit (code/security, docs, runtime UX, F5 and packaging config, each finding challenged by a skeptic) confirmed these, all fixed
and re-verified against the running app: (1) the navigation lock accepted any `file://` URL and the IPC trust check only compared `webContents`;
now only the app's own page may be loaded (`isAppUrl`, also on `will-frame-navigate` / `will-redirect`) and IPC requires the main frame showing
that page; (2) `deactivate()` was fire-and-forget at quit; `before-quit` now holds the quit until modules finish (5 s each); (3) a UI module with a
bogus `icon` could blank the whole window including the X; validation is stricter and the shell has an error boundary; (4) all web permissions were
denied including clipboard writes; `clipboard-sanitized-write` is allowed; plus CSP `base-uri`/`form-action`, a single shared preload event
listener, stricter module-id pattern (no `a--b`, `a-`), the generator rejects empty titles, `skills:sync --check` fails when a skill cannot be synced,
test files are type-checked, `npm run dev` uses `--watch` so main edits restart Electron, `format:check` passes (design/ is ignored).
Accepted as-is: the single-instance lock makes a second launch exit silently (documented), activation is sequential (documented).

## D14. Real-API findings for the AI layer (2026-10-06)

The AI layer was validated against the live Claude API (`npm run test:live`, off by default, `src/main/ai/live/*.live.test.ts`, budget-capped, key read from the git-ignored `keyt.txt`, never printed). All nine checks pass on `claude-sonnet-5-5`. Facts future agents need:

- **Structured outputs have a total grammar-size limit** ("The compiled grammar is too large", HTTP 400, costs nothing). A 7-way union of element objects plus the style profile exceeded it. Fixes: a slide element is ONE flat object with a `type` enum (unused fields are `''`/0/false/`[]`; `src/main/ai/schemas/slide.ts`), and style synthesis is TWO streamed calls (core, then layouts + test slide). Making enums plain strings did not help; property count and nesting matter. Split big outputs instead.
- **Schema probes are almost free**: `max_tokens: 24` with the format returns 400 before generating, so a rejected schema costs $0 (an accepted one about $0.003).
- Working on Sonnet 5.5: adaptive thinking + `output_config.effort`, server-side fallback beta, `cache_control` on system and message blocks (second `writeSlide` read 8,058 cached tokens), `tool_choice: auto`, non-strict `apply_changes`, PNG image blocks and PDF document blocks.
- Cost seen: style learning about $0.24 for synthesis (two calls), about $0.03 per written slide (flat elements emit ~20 empty fields each).
- Quality notes: slides use tokens, two-tone titles and locked decorations correctly; defects to tighten in the prompt: the writer invents a lesson number, hard-codes uppercase kickers (case belongs to the component), and mixes bulleted and plain paragraphs in one body box.
- design/ai-pipeline.md still describes a union element wire and one-call synthesis: the code is the truth (implementation note pending in the design doc).
