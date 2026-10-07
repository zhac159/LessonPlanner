# Planning App

A modular Windows desktop app (Electron + TypeScript + React) that helps a teacher plan lessons around PowerPoint decks.

**Read [agents/README.md](agents/README.md) before doing anything.** It links the architecture, the module guide, the
conventions, the roadmap, the decision log and the skills.

The essentials (token-lean workflow: agents/EFFICIENCY.md; run tests with `npm run -s check`, read specs with `node scripts/spec.mjs`):

- `design/` (the owner's mockups and product brief) is the source of truth for look and behaviour; read it before UI/product work. Don't edit it from code tasks.
- A feature is a folder in `src/modules/<id>/` (`ui.tsx`, optional `main.ts`, `shared.ts`). Use `npm run new:module`. Don't edit the shell to register one.
- The renderer is sandboxed and offline. Network, files and secrets belong in a module's `main.ts`; talk to it with `api.invoke` / `ctx.handle` and `api.on` / `ctx.emit`.
- F5 in VS Code builds and runs the app. `npm run typecheck`, `npm test` and `npm run smoke` must pass before a change is done; read the smoke screenshots in `.artifacts/smoke/`.
- If Electron crashes with `reading 'isPackaged'`, unset `ELECTRON_RUN_AS_NODE` (VS Code sets it).
- Keep `agents/` truthful: update the docs and `agents/CHANGELOG.md` with every meaningful change. Skills live in `agents/skills/` and are mirrored to `.claude/skills/` by `npm run skills:sync`.
