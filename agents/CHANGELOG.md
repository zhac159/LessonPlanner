# Changelog

What changed and when, newest first. One short entry per meaningful change. Agents: add a line whenever you change
behaviour, structure, commands or conventions.

## 2026-10-06: Product build (design direction B)

- Foundations, UI kit, deck model, PowerPoint export (opened in real PowerPoint), AI layer (validated live against the Claude API: D14), style import, typed IPC contracts, e2e + visual tooling, token-lean workflow (agents/EFFICIENCY.md). Screens in progress.

## 2026-10-06: Hardening and design alignment

- Independent review round and fixes: see DECISIONS.md D13 (navigation lock, IPC sender check, async shutdown, error boundary, clipboard permission, `--watch` dev, formatting, test type-checking).
- Found the owner's `design/` folder; documented how it relates to the code (D12, ROADMAP "Design alignment"); palette values moved into `tokens.css` / `APP_CONFIG.windowBackground` so a re-skin is one small change.
- Docs corrected after the audit (main-module failures are only logged, `ctx.emit` semantics, `deactivate` semantics, run-and-verify script).

## 2026-10-06: Framework built

- Electron 44 + TypeScript + React 19 app scaffolded with electron-vite (see DECISIONS.md D1, D2).
- Frameless window with a custom title bar and a close (X) button at the top right (D6).
- Animated "Welcome Alice" splash that hands over to the app once modules are loaded (D7).
- Module system: `src/modules/<id>/{ui.tsx, main.ts, shared.ts}`, auto-discovered, failure-isolated (D3), generic IPC (D4).
- `home` reference module; `npm run new:module` generator.
- F5 in VS Code builds and runs the app; hot-reload and `npm start` configurations too.
- Vitest unit tests for the module registry; Playwright smoke test (`npm run smoke`, also works on a packaged exe via `--exe`).
- Packaging with electron-builder: NSIS installer (`npm run package`) and unpacked build (`npm run package:dir`).
- `agents/` knowledge base and skills (`add-module`, `run-and-verify`, `package-exe`, `update-agents-docs`), `CLAUDE.md`, `AGENTS.md`.
