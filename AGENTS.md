# Planning App: instructions for AI coding agents

This repository keeps all agent-facing knowledge in [`agents/`](agents/README.md). **Start with
[agents/README.md](agents/README.md)**: it explains the app, the commands, the architecture, how to add a feature
(a "module"), the conventions, the roadmap and the available skills ([agents/skills/](agents/skills/README.md)).

The owner's design lives in [`design/`](design/README.md) (product brief, mockups, plugin spec): it is the source of truth for how the app looks and behaves.

Work fast and token-lean: [agents/EFFICIENCY.md](agents/EFFICIENCY.md) (`npm run -s check`, `node scripts/spec.mjs`, `node scripts/shot.mjs`).

Hard rules, in short: features are modules under `src/modules/<id>/`; the renderer is sandboxed and offline (network, files
and secrets go through a module's `main.ts`); verify changes by running `npm run typecheck`, `npm test` and `npm run smoke`;
unset `ELECTRON_RUN_AS_NODE` before launching Electron from an editor-hosted agent; update the docs in `agents/` and its
CHANGELOG when you change behaviour.
